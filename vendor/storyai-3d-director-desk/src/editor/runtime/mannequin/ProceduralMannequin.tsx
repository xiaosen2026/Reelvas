import type { CharacterRigState } from "../../schema/directorProject";
import { getBodyPreset, type CharacterBodyType } from "./bodyTypes";
import { degreesToRadians, getBodyTypePoseLimit, getRotationFromControls, getSingleAxisRotation } from "./mannequinPose";
import { Foot, Hand, Head, Joint, Segment, Torso } from "./mannequinParts";

interface ProceduralMannequinProps {
  bodyType?: CharacterBodyType;
  color?: string;
  rigState?: CharacterRigState;
}

function clampDegrees(value: number, bodyType?: CharacterBodyType) {
  const limit = getBodyTypePoseLimit(bodyType);
  return Math.min(limit, Math.max(-limit, value));
}

function getLimbRotation(
  controls: Record<string, number>,
  prefix: string,
  bodyType?: CharacterBodyType
): [number, number, number] {
  return [
    degreesToRadians(clampDegrees(controls[`${prefix}.pitch`] ?? 0, bodyType)),
    degreesToRadians(clampDegrees(controls[`${prefix}.twist`] ?? 0, bodyType)),
    degreesToRadians(clampDegrees(controls[`${prefix}.spread`] ?? 0, bodyType)),
  ];
}

export function ProceduralMannequin({ bodyType, color = "#4F8EF7", rigState }: ProceduralMannequinProps) {
  const preset = getBodyPreset(bodyType);
  const controls = rigState?.controls ?? {};
  const p = preset.proportions;

  const bodyRotation = getRotationFromControls(controls, "body", preset.bodyType);
  const torsoRotation = getRotationFromControls(controls, "torso", preset.bodyType);
  const headRotation = getRotationFromControls(controls, "head", preset.bodyType);
  const leftShoulderRotation = getLimbRotation(controls, "leftShoulder", preset.bodyType);
  const rightShoulderRotation = getLimbRotation(controls, "rightShoulder", preset.bodyType);
  const leftElbowRotation = getSingleAxisRotation(controls, "leftElbow.bend", preset.bodyType);
  const rightElbowRotation = getSingleAxisRotation(controls, "rightElbow.bend", preset.bodyType);
  const leftHipRotation = getLimbRotation(controls, "leftHip", preset.bodyType);
  const rightHipRotation = getLimbRotation(controls, "rightHip", preset.bodyType);
  const leftKneeRotation = getSingleAxisRotation(controls, "leftKnee.bend", preset.bodyType);
  const rightKneeRotation = getSingleAxisRotation(controls, "rightKnee.bend", preset.bodyType);

  const abdomenY = p.hipY + p.pelvisRadius * 0.6 + p.torsoLowerHeight * 0.5;
  const chestY = abdomenY + p.torsoLowerHeight * 0.5 + p.torsoUpperHeight * 0.5 + p.torsoUpperRadius * 0.1;
  const neckY = chestY + p.torsoUpperHeight * 0.5 + p.neckHeight * 0.5 + p.torsoUpperRadius * 0.2;
  const headY = neckY + p.neckHeight * 0.5 + p.headRadius * 0.75;

  const shoulderY = chestY + p.torsoUpperHeight * 0.16 + p.shoulderRadius * 0.4;
  const armOriginY = shoulderY - p.shoulderRadius * 0.55;
  const elbowY = -(p.upperArmLength + p.upperArmRadius + p.elbowRadius);
  const wristY = -(p.forearmLength + p.forearmRadius + p.wristRadius);
  const handY = wristY - p.handRadius - 0.05;

  const hipJointY = p.hipY - p.pelvisRadius * 0.15;
  const legOriginY = p.hipY - p.pelvisRadius * 0.35;
  const kneeY = -(p.thighLength + p.thighRadius + p.kneeRadius);
  const ankleY = -(p.calfLength + p.calfRadius + p.ankleRadius);
  const footY = ankleY - p.footRadius - 0.045;
  const jointScale: [number, number, number] = [p.jointRadiusScale, p.jointRadiusScale, p.jointRadiusScale];

  return (
    <group name={`procedural-${preset.bodyType}`} rotation={bodyRotation} scale={preset.defaultScale}>
      <group rotation={torsoRotation}>
        <Torso
          abdomenPosition={[0, abdomenY, 0]}
          abdomenScale={p.torsoLowerScale}
          chestPosition={[0, chestY, 0]}
          chestScale={p.torsoUpperScale}
          color={color}
          pelvisPosition={[0, p.hipY, 0]}
          pelvisRadius={p.pelvisRadius}
          pelvisScale={p.pelvisScale}
          torsoLowerHeight={p.torsoLowerHeight}
          torsoLowerRadius={p.torsoLowerRadius}
          torsoUpperHeight={p.torsoUpperHeight}
          torsoUpperRadius={p.torsoUpperRadius}
        />
        <Head
          color={color}
          eyeRadius={p.eyeRadius}
          faceOffsetZ={p.faceOffsetZ}
          headRadius={p.headRadius}
          headScale={p.headScale}
          mouthScale={p.mouthScale}
          neckHeight={p.neckHeight}
          neckPosition={[0, neckY, 0]}
          neckRadius={p.neckRadius}
          noseScale={p.noseScale}
          position={[0, headY, 0]}
          rotation={headRotation}
        />

        <Joint color={color} position={[-p.shoulderWidth * 0.86, shoulderY, 0]} radius={p.shoulderRadius} scale={jointScale} />
        <Joint color={color} position={[p.shoulderWidth * 0.86, shoulderY, 0]} radius={p.shoulderRadius} scale={jointScale} />

        <group position={[-p.shoulderWidth, armOriginY, 0]} rotation={leftShoulderRotation}>
          <Segment
            color={color}
            length={p.upperArmLength}
            position={[0, -(p.upperArmLength * 0.5 + p.upperArmRadius), 0]}
            radius={p.upperArmRadius}
          />
          <group position={[0, elbowY, 0]} rotation={leftElbowRotation}>
            <Joint color={color} position={[0, 0, 0]} radius={p.elbowRadius} scale={jointScale} />
            <Segment
              color={color}
              length={p.forearmLength}
              position={[0, -(p.forearmLength * 0.5 + p.forearmRadius), 0]}
              radius={p.forearmRadius}
            />
            <Joint color={color} position={[0, wristY, 0]} radius={p.wristRadius} scale={jointScale} />
            <Hand color={color} position={[0, handY, 0.02]} radius={p.handRadius} scale={p.handScale} side="left" />
          </group>
        </group>

        <group position={[p.shoulderWidth, armOriginY, 0]} rotation={rightShoulderRotation}>
          <Segment
            color={color}
            length={p.upperArmLength}
            position={[0, -(p.upperArmLength * 0.5 + p.upperArmRadius), 0]}
            radius={p.upperArmRadius}
          />
          <group position={[0, elbowY, 0]} rotation={rightElbowRotation}>
            <Joint color={color} position={[0, 0, 0]} radius={p.elbowRadius} scale={jointScale} />
            <Segment
              color={color}
              length={p.forearmLength}
              position={[0, -(p.forearmLength * 0.5 + p.forearmRadius), 0]}
              radius={p.forearmRadius}
            />
            <Joint color={color} position={[0, wristY, 0]} radius={p.wristRadius} scale={jointScale} />
            <Hand color={color} position={[0, handY, 0.02]} radius={p.handRadius} scale={p.handScale} side="right" />
          </group>
        </group>
      </group>

      <Joint color={color} position={[-p.legSpread, hipJointY, 0]} radius={p.thighRadius * 1.08} scale={jointScale} />
      <Joint color={color} position={[p.legSpread, hipJointY, 0]} radius={p.thighRadius * 1.08} scale={jointScale} />

      <group position={[-p.legSpread, legOriginY, 0]} rotation={leftHipRotation}>
        <Segment
          color={color}
          length={p.thighLength}
          position={[0, -(p.thighLength * 0.5 + p.thighRadius), 0]}
          radius={p.thighRadius}
        />
        <group position={[0, kneeY, 0]} rotation={leftKneeRotation}>
          <Joint color={color} position={[0, 0, 0]} radius={p.kneeRadius} scale={jointScale} />
          <Segment
            color={color}
            length={p.calfLength}
            position={[0, -(p.calfLength * 0.5 + p.calfRadius), 0]}
            radius={p.calfRadius}
          />
          <Joint color={color} position={[0, ankleY, 0]} radius={p.ankleRadius} scale={jointScale} />
          <Foot color={color} length={p.footLength} position={[0, footY, p.footRadius * 0.74]} radius={p.footRadius} scale={p.footScale} side="left" />
        </group>
      </group>

      <group position={[p.legSpread, legOriginY, 0]} rotation={rightHipRotation}>
        <Segment
          color={color}
          length={p.thighLength}
          position={[0, -(p.thighLength * 0.5 + p.thighRadius), 0]}
          radius={p.thighRadius}
        />
        <group position={[0, kneeY, 0]} rotation={rightKneeRotation}>
          <Joint color={color} position={[0, 0, 0]} radius={p.kneeRadius} scale={jointScale} />
          <Segment
            color={color}
            length={p.calfLength}
            position={[0, -(p.calfLength * 0.5 + p.calfRadius), 0]}
            radius={p.calfRadius}
          />
          <Joint color={color} position={[0, ankleY, 0]} radius={p.ankleRadius} scale={jointScale} />
          <Foot color={color} length={p.footLength} position={[0, footY, p.footRadius * 0.74]} radius={p.footRadius} scale={p.footScale} side="right" />
        </group>
      </group>
    </group>
  );
}
