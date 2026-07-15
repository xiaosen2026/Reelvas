import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { Box3, Vector3 } from "three";
import { afterEach, beforeEach, vi } from "vitest";
import { VIEWPORT_CAMERA_VISUAL_SCALE } from "../schema/cameraGeometry";
import { createInitialDirectorState, useDirectorStore } from "../store/directorStore";
import { getImportedModelNormalization, SceneRoot } from "./SceneRoot";

const mockCharacterModelShouldSuspend = vi.hoisted(() => ({ current: false }));

vi.mock("@react-three/drei", async () => {
  const actual = await vi.importActual<typeof import("@react-three/drei")>("@react-three/drei");

  return {
    ...actual,
    Html: ({
      center,
      children,
      distanceFactor,
      pointerEvents,
      position,
      sprite,
      transform,
      zIndexRange,
    }: {
      center?: boolean;
      children?: React.ReactNode;
      distanceFactor?: number;
      pointerEvents?: string;
      position?: [number, number, number];
      sprite?: boolean;
      transform?: boolean;
      zIndexRange?: [number, number];
    }) => (
      <div
        data-center={center ? "true" : "false"}
        data-distance-factor={distanceFactor}
        data-pointer-events={pointerEvents}
        data-position={JSON.stringify(position)}
        data-sprite={sprite ? "true" : "false"}
        data-testid="html-label"
        data-transform={transform ? "true" : "false"}
        data-z-index-range={JSON.stringify(zIndexRange)}
      >
        {children}
      </div>
    ),
    Line: ({
      color,
      lineWidth,
      name,
      opacity,
      onClick,
      points,
      transparent,
    }: {
      color?: string;
      lineWidth?: number;
      name?: string;
      onClick?: React.MouseEventHandler<HTMLDivElement>;
      opacity?: number;
      points?: Array<[number, number, number]>;
      transparent?: boolean;
    }) => (
      <div
        data-clickable={onClick ? "true" : "false"}
        data-color={color}
        data-line-width={lineWidth}
        data-name={name}
        data-opacity={opacity}
        data-point-count={points?.length}
        data-points={JSON.stringify(points)}
        data-testid="camera-line"
        data-transparent={transparent ? "true" : "false"}
        onClick={onClick}
      />
    ),
    useProgress: () => ({ progress: 0 }),
    Bounds: ({ children }: { children?: React.ReactNode }) => <>{children}</>,
    TransformControls: ({
      children,
      mode,
      object,
      translationSnap,
      userData,
    }: {
      children?: React.ReactNode;
      mode?: string;
      object?: { current: unknown };
      translationSnap?: number | null;
      userData?: Record<string, unknown>;
    }) => (
      <div
        data-has-object={object ? "true" : "false"}
        data-hide-from-capture={userData?.hideFromViewportCapture ? "true" : "false"}
        data-mode={mode}
        data-translation-snap={translationSnap == null ? "null" : String(translationSnap)}
        data-testid="transform-controls"
      >
        {children}
      </div>
    ),
  };
});

vi.mock("../runtime/PrimitiveMannequin", () => ({
  PrimitiveMannequin: ({
    bodyType,
    color,
    rigState,
  }: {
    bodyType?: string;
    color?: string;
    rigState?: { rigType?: string };
  }) => (
    <div
      data-body-type={bodyType}
      data-color={color}
      data-rig-type={rigState?.rigType}
      data-testid="mock-primitive-mannequin"
    />
  ),
}));

vi.mock("../runtime/CharacterModel", async () => {
  const React = await vi.importActual<typeof import("react")>("react");

  return {
    CharacterModel: ({
      bodyType,
      color,
      onLabelAnchorYChange,
      rigState,
    }: {
      bodyType?: string;
      color?: string;
      onLabelAnchorYChange?: (anchorY: number) => void;
      rigState?: { rigType?: string };
    }) => {
      if (mockCharacterModelShouldSuspend.current) {
        throw new Promise(() => undefined);
      }

      const labelAnchorY = bodyType === "chibi" ? 0.92 : 2.04;

      React.useLayoutEffect(() => {
        onLabelAnchorYChange?.(labelAnchorY);
      }, [labelAnchorY, onLabelAnchorYChange]);

      return (
        <div data-body-type={bodyType} data-color={color} data-rig-type={rigState?.rigType} data-testid="mock-character-model" />
      );
    },
  };
});

beforeEach(() => {
  vi.spyOn(console, "error").mockImplementation(() => {});
  mockCharacterModelShouldSuspend.current = false;
  const base = createInitialDirectorState();
  useDirectorStore.setState({
    ...useDirectorStore.getState(),
    ...base,
    project: {
      ...base.project,
      panoramaAssetId: "asset_panorama_1",
      assets: [
        {
          id: "asset_panorama_1",
          kind: "panorama",
          sourceType: "image",
          fileName: "studio-360.jpg",
          url: "blob:studio-360",
        },
      ],
    },
  });
});

afterEach(() => {
  vi.restoreAllMocks();
});

function getUniquePoints(points: Array<[number, number, number]>) {
  return Array.from(new Map(points.map((point) => [point.join(","), point])).values());
}

it("renders role labels while panorama background is managed by the viewport layer", () => {
  render(<SceneRoot />);

  expect(screen.queryByTestId("panorama-sphere")).not.toBeInTheDocument();
  expect(screen.getByText("角色01")).toBeInTheDocument();
});

it("does not flash the procedural mannequin while the default UE4 role model is loading", () => {
  mockCharacterModelShouldSuspend.current = true;

  render(<SceneRoot />);

  expect(screen.queryByTestId("mock-character-model")).not.toBeInTheDocument();
  expect(screen.queryByTestId("mock-primitive-mannequin")).not.toBeInTheDocument();
  expect(screen.getByText("角色01")).toBeInTheDocument();
  expect(screen.getByText("机位01")).toBeInTheDocument();
});

it("renders role labels as centered 3D billboards that scale with viewport distance", () => {
  render(<SceneRoot />);

  const label = screen.getByText("角色01").closest('[data-testid="html-label"]');

  expect(label).toHaveAttribute("data-position", "[0,2.04,0]");
  expect(label).toHaveAttribute("data-center", "true");
  expect(label).toHaveAttribute("data-transform", "true");
  expect(label).toHaveAttribute("data-sprite", "true");
  expect(label).toHaveAttribute("data-pointer-events", "none");
  expect(label).toHaveAttribute("data-distance-factor", "3");
  expect(label).toHaveAttribute("data-z-index-range", "[0,1]");
});

it("updates short role labels from the measured character model height", async () => {
  useDirectorStore.getState().updateCharacterBodyType("char_default_a", "chibi");

  render(<SceneRoot />);

  const label = screen.getByText("角色01").closest('[data-testid="html-label"]');

  await waitFor(() => {
    expect(label).toHaveAttribute("data-position", "[0,0.92,0]");
  });
});

it("passes distinct character colors into every viewport character model", () => {
  useDirectorStore.getState().addPresetCharacter("female");
  useDirectorStore.getState().addPresetCharacter("teen");

  render(<SceneRoot />);

  const characterColors = screen.getAllByTestId("mock-character-model").map((model) => model.dataset.color);

  expect(characterColors).toEqual(["#4F8EF7", "#E0524D", "#E91E63"]);
  expect(new Set(characterColors).size).toBe(characterColors.length);
});

it("renders viewport camera labels with the same 3D label behavior as role labels", () => {
  render(<SceneRoot />);

  const label = screen.getByText("机位01").closest('[data-testid="html-label"]');
  const position = JSON.parse(label?.getAttribute("data-position") ?? "[]") as [number, number, number];

  expect(position[0]).toBeCloseTo(0);
  expect(position[1]).toBeCloseTo(0.65 * VIEWPORT_CAMERA_VISUAL_SCALE + 0.18);
  expect(position[2]).toBeCloseTo(0);
  expect(label).toHaveAttribute("data-center", "true");
  expect(label).toHaveAttribute("data-transform", "true");
  expect(label).toHaveAttribute("data-sprite", "true");
  expect(label).toHaveAttribute("data-pointer-events", "none");
  expect(label).toHaveAttribute("data-distance-factor", "3");
  expect(label).toHaveAttribute("data-z-index-range", "[0,1]");
});

it("uses the requested dark ground surface color", () => {
  const { container } = render(<SceneRoot />);
  const groundMaterial = container.querySelector('meshbasicmaterial[color="#303640"]');

  expect(groundMaterial).toBeInTheDocument();
  expect(groundMaterial?.outerHTML.toLowerCase()).toContain("polygonoffsetfactor=\"1\"");
  expect(groundMaterial?.outerHTML.toLowerCase()).toContain("polygonoffsetunits=\"1\"");
});

it("renders added geometry primitives as light blue-white models", () => {
  useDirectorStore.getState().addGeometryPrimitive("sphere");

  const { container } = render(<SceneRoot />);

  expect(container.querySelector('mesh[name="geometry-sphere"]')).toBeInTheDocument();
  expect(container.querySelector("spheregeometry")).toBeInTheDocument();
  expect(container.querySelector('meshstandardmaterial[color="#d7e7ff"]')).toBeInTheDocument();
});

it("does not render name labels above geometry primitives", () => {
  useDirectorStore.getState().addGeometryPrimitive("sphere");

  render(<SceneRoot />);

  expect(screen.getByText("角色01")).toBeInTheDocument();
  expect(screen.getByText("机位01")).toBeInTheDocument();
  expect(screen.queryByText("球体")).not.toBeInTheDocument();
});

it("grounds the torus geometry primitive on the floor", () => {
  useDirectorStore.getState().addGeometryPrimitive("torus");

  const { container } = render(<SceneRoot />);
  const torus = container.querySelector('mesh[name="geometry-torus"]');
  const geometry = torus?.querySelector("torusgeometry");
  const position = String(torus?.getAttribute("position") ?? "")
    .split(",")
    .map(Number) as [number, number, number];
  const [, tubeRadius] = String(geometry?.getAttribute("args") ?? "")
    .split(",")
    .map(Number);

  expect(torus).toBeInTheDocument();
  expect(position[1] - tubeRadius).toBeCloseTo(0);
});

it("normalizes imported model bounds to a director-desk friendly size on the ground", () => {
  const normalization = getImportedModelNormalization(
    new Box3(new Vector3(2, -3, -4), new Vector3(12, 2, 2)),
    2
  );

  expect(normalization.scale).toBeCloseTo(0.2);
  expect(normalization.position[0]).toBeCloseTo(-1.4);
  expect(normalization.position[1]).toBeCloseTo(0.6);
  expect(normalization.position[2]).toBeCloseTo(0.2);
});

it("wraps each imported model in its own loading boundary so the rest of the scene stays mounted", () => {
  const base = createInitialDirectorState();
  useDirectorStore.setState({
    ...useDirectorStore.getState(),
    ...base,
    project: {
      ...base.project,
      assets: [
        {
          id: "asset_model_1",
          kind: "prop",
          sourceType: "model",
          fileName: "microwave_low.fbx",
          url: "blob:microwave",
        },
      ],
      objects: [
        ...base.project.objects,
        {
          id: "obj_model_1",
          name: "微波炉",
          kind: "prop",
          visible: true,
          locked: false,
          assetRefId: "asset_model_1",
          transform: {
            position: [0, 0, 0],
            rotation: [0, 0, 0],
            scale: [1, 1, 1],
          },
        },
      ],
    },
  });

  render(<SceneRoot />);

  expect(screen.getByText("角色01")).toBeInTheDocument();
  expect(screen.getByText("机位01")).toBeInTheDocument();
});

it("keeps imported model normalization neutral for empty bounds", () => {
  const normalization = getImportedModelNormalization(new Box3(), 2);

  expect(normalization.scale).toBe(1);
  expect(normalization.position).toEqual([0, 0, 0]);
});

it("renders the viewport camera as a reference-style blue wireframe model and viewfinder", () => {
  const { container } = render(<SceneRoot />);

  expect(screen.getByText("机位01")).toBeInTheDocument();
  expect(container.querySelector('meshstandardmaterial[color="#D88900"]')).not.toBeInTheDocument();
  expect(container.querySelector('meshstandardmaterial[color="#05070A"]')).not.toBeInTheDocument();
  expect(container.querySelector('meshstandardmaterial[color="#FF2B19"]')).not.toBeInTheDocument();

  const blueLines = screen.getAllByTestId("camera-line").filter((line) => line.dataset.color === "#A9D8FF");
  const bodyLines = blueLines.filter((line) => line.dataset.name?.includes("-body-"));
  const lensLines = blueLines.filter((line) => line.dataset.name?.includes("-lens-"));
  const reelLines = blueLines.filter((line) => line.dataset.name?.includes("-reel-"));
  const viewfinderLines = blueLines.filter((line) => line.dataset.name?.includes("-viewfinder-"));
  const modelLines = [...bodyLines, ...lensLines, ...reelLines];
  const allBodyPoints = bodyLines.flatMap((line) => JSON.parse(line.dataset.points ?? "[]") as Array<[number, number, number]>);
  const bodyWidth = Math.max(...allBodyPoints.map((point) => point[0])) - Math.min(...allBodyPoints.map((point) => point[0]));
  const bodyHeight = Math.max(...allBodyPoints.map((point) => point[1])) - Math.min(...allBodyPoints.map((point) => point[1]));
  const bodyDepth = Math.max(...allBodyPoints.map((point) => point[2])) - Math.min(...allBodyPoints.map((point) => point[2]));
  const closedLensRings = lensLines.filter((line) => {
    const points = JSON.parse(line.dataset.points ?? "[]") as Array<[number, number, number]>;
    const firstPoint = points[0];
    const lastPoint = points[points.length - 1];
    return (
      points.length === 5 &&
      firstPoint?.[0] === lastPoint?.[0] &&
      firstPoint?.[1] === lastPoint?.[1] &&
      firstPoint?.[2] === lastPoint?.[2]
    );
  });

  expect(modelLines).toHaveLength(20);
  expect(bodyWidth).toBeCloseTo(0.4 * VIEWPORT_CAMERA_VISUAL_SCALE);
  expect(bodyHeight).toBeCloseTo(0.4 * VIEWPORT_CAMERA_VISUAL_SCALE);
  expect(bodyDepth / bodyWidth).toBeGreaterThan(2.4);
  expect(lensLines).toHaveLength(6);
  expect(reelLines).toHaveLength(2);
  expect(reelLines.every((line) => Number(line.dataset.pointCount) > 20)).toBe(true);
  expect(closedLensRings).toHaveLength(2);
  expect(viewfinderLines).toHaveLength(8);
  expect(new Set(blueLines.map((line) => line.dataset.color))).toEqual(new Set(["#A9D8FF"]));
  expect(new Set(blueLines.map((line) => line.dataset.opacity))).toEqual(new Set(["0.92"]));
  expect(new Set(blueLines.map((line) => line.dataset.lineWidth))).toEqual(new Set(["1"]));
  expect(modelLines.every((line) => line.dataset.clickable === "true")).toBe(true);
  expect(viewfinderLines[0]).toHaveAttribute("data-transparent", "true");
  expect(viewfinderLines[0]).toHaveAttribute("data-point-count", "2");
  const firstLinePoints = JSON.parse(viewfinderLines[0].dataset.points ?? "[]") as Array<[number, number, number]>;
  const lensPoints = lensLines.flatMap((line) => JSON.parse(line.dataset.points ?? "[]") as Array<[number, number, number]>);
  const lensMaxZ = Math.max(...lensPoints.map((point) => point[2]));
  const frontFramePoints = getUniquePoints(lensPoints.filter((point) => point[2] === lensMaxZ));
  const lensFrontCenter = frontFramePoints
    .reduce(
      (acc, point) => [acc[0] + point[0], acc[1] + point[1], acc[2] + point[2]] as [number, number, number],
      [0, 0, 0] as [number, number, number]
    )
    .map((value) => Number((value / frontFramePoints.length).toFixed(6))) as [number, number, number];
  expect(firstLinePoints[0]?.[0]).toBeCloseTo(lensFrontCenter[0]);
  expect(firstLinePoints[0]?.[1]).toBeCloseTo(lensFrontCenter[1]);
  expect(firstLinePoints[0]?.[2]).toBeCloseTo(lensFrontCenter[2]);
  expect(firstLinePoints[1]?.[2]).toBeGreaterThan(firstLinePoints[0]?.[2] ?? 0);
});

it("selects the viewport camera when users click a camera model line", () => {
  render(<SceneRoot />);

  const bodyLine = screen.getAllByTestId("camera-line").find((line) => line.dataset.name?.includes("-body-"));
  expect(bodyLine).toHaveAttribute("data-clickable", "true");

  fireEvent.click(bodyLine!);

  expect(useDirectorStore.getState().selectedObjectId).toBe("cam_object_1");
});

it("selects the viewport camera from the enlarged wireframe hit area", () => {
  const { container } = render(<SceneRoot />);
  const hitArea = container.querySelector('mesh[name="cam_1-hit-area"]');

  expect(hitArea).toBeInTheDocument();
  fireEvent.click(hitArea!);

  expect(useDirectorStore.getState().selectedObjectId).toBe("cam_object_1");
});

it("shows transform controls when a viewport camera is selected", () => {
  useDirectorStore.setState({
    ...useDirectorStore.getState(),
    selectedObjectId: "cam_object_1",
    transformMode: "rotate",
  });

  render(<SceneRoot />);

  expect(screen.getByTestId("transform-controls")).toHaveAttribute("data-mode", "rotate");
  expect(screen.getByTestId("transform-controls")).toHaveAttribute("data-has-object", "true");
  expect(screen.getByTestId("transform-controls")).toHaveAttribute("data-hide-from-capture", "true");
});

it("hides role labels when the scene toggle is disabled", () => {
  useDirectorStore.setState({
    ...useDirectorStore.getState(),
    project: {
      ...useDirectorStore.getState().project,
      scene: {
        ...useDirectorStore.getState().project.scene,
        showLabels: false,
      },
    },
  });

  render(<SceneRoot />);

  expect(screen.queryByText("角色01")).not.toBeInTheDocument();
});

it("shows transform controls around the selected character in the active tool mode", () => {
  useDirectorStore.setState({
    ...useDirectorStore.getState(),
    selectedObjectId: "char_default_a",
    transformMode: "rotate",
  });

  render(<SceneRoot />);

  expect(screen.getByTestId("transform-controls")).toHaveAttribute("data-mode", "rotate");
  expect(screen.getByTestId("transform-controls")).toHaveAttribute("data-has-object", "true");
  expect(screen.getByTestId("transform-controls")).toHaveAttribute("data-hide-from-capture", "true");
  expect(screen.getByTestId("transform-controls")).toHaveAttribute("data-translation-snap", "null");
});

it("shows transform controls around selected models while in camera view", () => {
  useDirectorStore.setState({
    ...useDirectorStore.getState(),
    viewMode: "camera",
    selectedObjectId: "char_default_a",
    transformMode: "scale",
  });

  render(<SceneRoot />);

  expect(screen.getByTestId("transform-controls")).toHaveAttribute("data-mode", "scale");
  expect(screen.getByTestId("transform-controls")).toHaveAttribute("data-has-object", "true");
  expect(screen.getByTestId("transform-controls")).toHaveAttribute("data-translation-snap", "null");
});

it("selects the whole crowd group and shows one transform control when users click a crowd member", () => {
  useDirectorStore.getState().addCrowdCharacters({ rows: 2, columns: 2, spacing: 1.2 });

  render(<SceneRoot />);

  fireEvent.click(screen.getAllByTestId("mock-character-model")[1]!);

  expect(useDirectorStore.getState().selectedCrowdId).toBe("crowd_1");
  expect(useDirectorStore.getState().selectedObjectIds).toHaveLength(4);
  expect(screen.getAllByTestId("transform-controls")).toHaveLength(1);
});

it("passes world-grid snapping into viewport transform controls while translating selected objects", () => {
  useDirectorStore.setState({
    ...useDirectorStore.getState(),
    selectedObjectId: "char_default_a",
    transformMode: "translate",
    project: {
      ...useDirectorStore.getState().project,
      scene: {
        ...useDirectorStore.getState().project.scene,
        snapToGrid: true,
      },
    },
  });

  render(<SceneRoot />);

  expect(screen.getByTestId("transform-controls")).toHaveAttribute("data-mode", "translate");
  expect(screen.getByTestId("transform-controls")).toHaveAttribute("data-translation-snap", "1");
});

it("passes character body type to the procedural mannequin", () => {
  const state = createInitialDirectorState();
  const character = state.project.objects.find((item) => item.kind === "character");
  expect(character).toBeTruthy();

  useDirectorStore.setState({
    ...state,
    project: {
      ...state.project,
      objects: state.project.objects.map((item) =>
        item.id === character!.id ? { ...item, bodyType: "chibi" } : item
      ),
    },
  });

  render(<SceneRoot />);

  expect(screen.getByTestId("mock-character-model")).toHaveAttribute("data-body-type", "chibi");
});

it("uses the built-in UE4 mannequin rig for default generated characters", () => {
  render(<SceneRoot />);

  expect(screen.getByTestId("mock-character-model")).toHaveAttribute("data-rig-type", "ue4-mannequin");
});
