import { afterEach, beforeEach, vi } from "vitest";
import { createDefaultDirectorProject, createInitialDirectorState, useDirectorStore } from "./directorStore";
import { selectRightPanelKind } from "./directorSelectors";
import { getCameraRigPositionFromViewSnapshot } from "../schema/cameraGeometry";

function createMemoryStorage(): Storage {
  const storage = new Map<string, string>();

  return {
    get length() {
      return storage.size;
    },
    clear: () => storage.clear(),
    getItem: (key) => storage.get(key) ?? null,
    key: (index) => Array.from(storage.keys())[index] ?? null,
    removeItem: (key) => {
      storage.delete(key);
    },
    setItem: (key, value) => {
      storage.set(key, String(value));
    },
  };
}

beforeEach(() => {
  vi.stubGlobal("localStorage", createMemoryStorage());
  useDirectorStore.getState().openScopedScene(null);
  useDirectorStore.setState({
    ...useDirectorStore.getState(),
    ...createInitialDirectorState(),
    clipboard: [],
    clipboardPasteCount: 0,
    undoStack: [],
    undoBatchDepth: 0,
    undoBatchSnapshot: null,
    undoBatchHasTrackedChanges: false,
  });
});

afterEach(() => {
  vi.unstubAllGlobals();
});

it("seeds the demo with one mannequin role and one camera", () => {
  const state = createInitialDirectorState();
  const defaultCharacter = state.project.objects.find((item) => item.kind === "character");
  const defaultCameraObject = state.project.objects.find((item) => item.kind === "camera");

  expect(state.viewMode).toBe("director");
  expect(state.viewportAspectRatio).toBe("auto");
  expect(state.viewportRuleOfThirdsEnabled).toBe(false);
  expect(state.project.scene.backgroundColor).toBe("#000000");
  expect(defaultCharacter?.name).toBe("角色01");
  expect(defaultCameraObject?.name).toBe("机位01");
  expect(state.project.cameras[0]?.name).toBe("机位01");
  expect(state.project.objects.some((item) => item.kind === "character")).toBe(true);
  expect(state.project.cameras).toHaveLength(1);
});

it("updates the viewport aspect ratio selection in ui state", () => {
  useDirectorStore.setState(createInitialDirectorState());

  useDirectorStore.getState().setViewportAspectRatio("9:16");

  expect(useDirectorStore.getState().viewportAspectRatio).toBe("9:16");
});

it("updates the viewport rule-of-thirds guide toggle in ui state", () => {
  useDirectorStore.setState(createInitialDirectorState());

  useDirectorStore.getState().setViewportRuleOfThirdsEnabled(true);

  expect(useDirectorStore.getState().viewportRuleOfThirdsEnabled).toBe(true);
});

it("toggles the viewport side panel collapse flag in ui state", () => {
  useDirectorStore.setState(createInitialDirectorState());

  type CollapseUiState = ReturnType<typeof useDirectorStore.getState> & {
    viewportPanelsCollapsed?: boolean;
    toggleViewportPanelsCollapsed?: () => void;
  };
  const state = useDirectorStore.getState() as CollapseUiState;

  expect(state.viewportPanelsCollapsed ?? false).toBe(false);

  state.toggleViewportPanelsCollapsed?.();

  expect((useDirectorStore.getState() as CollapseUiState).viewportPanelsCollapsed ?? false).toBe(true);
});

it("routes the right panel by object type and view mode", () => {
  const state = createInitialDirectorState();
  const characterId = state.project.objects.find((item) => item.kind === "character")!.id;
  const cameraObjectId = state.project.objects.find((item) => item.kind === "camera")!.id;
  const propState = {
    ...state,
    selectedObjectId: "prop_model_1",
    project: {
      ...state.project,
      objects: [
        ...state.project.objects,
        {
          id: "prop_model_1",
          name: "自动取款机",
          kind: "prop" as const,
          visible: true,
          locked: false,
          assetRefId: "asset_model_1",
          transform: {
            position: [0, 0, 0] as [number, number, number],
            rotation: [0, 0, 0] as [number, number, number],
            scale: [1, 1, 1] as [number, number, number],
          },
        },
      ],
      assets: [
        ...state.project.assets,
        {
          id: "asset_model_1",
          kind: "prop" as const,
          sourceType: "model" as const,
          fileName: "ATM_low.fbx",
          url: "blob:atm",
        },
      ],
    },
  };

  expect(selectRightPanelKind(state)).toBe("scene");
  expect(selectRightPanelKind({ ...state, selectedObjectId: characterId })).toBe("character");
  expect(selectRightPanelKind({ ...state, selectedObjectId: cameraObjectId })).toBe("camera");
  expect(selectRightPanelKind(propState)).toBe("prop");
  expect(selectRightPanelKind({ ...state, viewMode: "camera", selectedObjectId: null })).toBe("camera");
});

it("routes a selected crowd group to the role panel", () => {
  const state = createInitialDirectorState();

  expect(selectRightPanelKind({ ...state, selectedCrowdId: "crowd_1" })).toBe("character");
});

it("routes older model-backed scene objects to the model panel", () => {
  const state = createInitialDirectorState();

  expect(
    selectRightPanelKind({
      ...state,
      selectedObjectId: "obj_scene_model_1",
      project: {
        ...state.project,
        assets: [
          {
            id: "asset_scene_model_1",
            kind: "scene",
            sourceType: "model",
            fileName: "microwave_low.fbx",
            url: "blob:microwave",
          },
        ],
        objects: [
          ...state.project.objects,
          {
            id: "obj_scene_model_1",
            name: "微波炉",
            kind: "scene",
            visible: true,
            locked: false,
            assetRefId: "asset_scene_model_1",
            transform: {
              position: [0, 0, 0],
              rotation: [0, 0, 0],
              scale: [1, 1, 1],
            },
          },
        ],
      },
    })
  ).toBe("prop");
});

it("defaults generated characters to the male mannequin body type", () => {
  const project = createDefaultDirectorProject();
  const character = project.objects.find((item) => item.kind === "character");

  expect(character?.bodyType).toBe("mannequin");
});

it("adds preset characters with a requested body type", () => {
  useDirectorStore.setState(createInitialDirectorState());

  useDirectorStore.getState().addPresetCharacter("female");

  const characters = useDirectorStore.getState().project.objects.filter((item) => item.kind === "character");
  const added = characters[characters.length - 1];

  expect(added?.bodyType).toBe("female");
  expect(added?.name).toBe("角色02");
  expect(added?.characterRig?.rigType).toBe("ue4-mannequin");
  expect(useDirectorStore.getState().selectedObjectId).toBe(added?.id);
});

it("adds camera shots with two-digit camera names", () => {
  useDirectorStore.setState(createInitialDirectorState());

  useDirectorStore.getState().addCameraShot();

  const state = useDirectorStore.getState();

  expect(state.project.cameras.map((camera) => camera.name)).toEqual(["机位01", "机位02"]);
  expect(state.project.objects.filter((item) => item.kind === "camera").map((item) => item.name)).toEqual([
    "机位01",
    "机位02",
  ]);
});

it("keeps the default character blue and gives newly added characters distinct colors", () => {
  useDirectorStore.setState(createInitialDirectorState());

  useDirectorStore.getState().addPresetCharacter("female");
  useDirectorStore.getState().addPresetCharacter("teen");

  const characters = useDirectorStore.getState().project.objects.filter((item) => item.kind === "character");

  expect(characters[0].color).toBe("#4F8EF7");
  expect(new Set(characters.map((item) => item.color)).size).toBe(characters.length);
});

it("places newly added preset characters far enough from the default role to avoid overlap", () => {
  useDirectorStore.setState(createInitialDirectorState());

  useDirectorStore.getState().addPresetCharacter("female");
  useDirectorStore.getState().addPresetCharacter("teen");

  const characters = useDirectorStore.getState().project.objects.filter((item) => item.kind === "character");
  const defaultRole = characters.find((item) => item.id === "char_default_a");
  const role02 = characters.find((item) => item.name === "角色02");
  const role03 = characters.find((item) => item.name === "角色03");

  expect(defaultRole?.transform.position).toEqual([0, 0, 0]);
  expect(role02?.transform.position).toEqual([-1.25, 0, 0]);
  expect(role03?.transform.position).toEqual([1.25, 0, 0]);
});

it("adds selected geometry primitives as light blue-white prop objects", () => {
  useDirectorStore.setState(createInitialDirectorState());

  useDirectorStore.getState().addGeometryPrimitive("torus");

  const prop = useDirectorStore.getState().project.objects.find((item) => item.kind === "prop");

  expect(prop?.name).toBe("环状体");
  expect(prop?.geometryType).toBe("torus");
  expect(prop?.color).toBe("#d7e7ff");
  expect(useDirectorStore.getState().selectedObjectId).toBe(prop?.id);
});

it("deletes the selected list object and linked camera data", () => {
  useDirectorStore.setState(createInitialDirectorState());
  useDirectorStore.getState().addCameraShot();

  expect(useDirectorStore.getState().project.cameras).toHaveLength(2);

  useDirectorStore.getState().deleteSelectedObject();

  const state = useDirectorStore.getState();

  expect(state.selectedObjectId).toBeNull();
  expect(state.project.objects.some((item) => item.id === "cam_object_2")).toBe(false);
  expect(state.project.cameras.some((item) => item.id === "cam_2")).toBe(false);
  expect(state.project.activeCameraId).toBe("cam_1");
});

it("supports multi-selecting objects and deleting the selected set", () => {
  useDirectorStore.setState(createInitialDirectorState());
  useDirectorStore.getState().addPresetCharacter("female");

  useDirectorStore.getState().selectObject("char_default_a");
  useDirectorStore.getState().toggleObjectSelection("char_preset_2");

  expect(useDirectorStore.getState().selectedObjectId).toBe("char_preset_2");
  expect(useDirectorStore.getState().selectedObjectIds).toEqual(["char_default_a", "char_preset_2"]);

  useDirectorStore.getState().deleteSelectedObject();

  const state = useDirectorStore.getState();

  expect(state.selectedObjectId).toBeNull();
  expect(state.selectedObjectIds).toEqual([]);
  expect(state.project.objects.some((item) => item.id === "char_default_a")).toBe(false);
  expect(state.project.objects.some((item) => item.id === "char_preset_2")).toBe(false);
});

it("updates a character body type without changing transform or color", () => {
  useDirectorStore.setState(createInitialDirectorState());
  const character = useDirectorStore.getState().project.objects.find((item) => item.kind === "character");
  expect(character).toBeTruthy();

  useDirectorStore.getState().updateObjectColor(character!.id, "#123456");
  useDirectorStore.getState().updateObjectTransform(character!.id, { position: [1, 2, 3] });
  useDirectorStore.getState().updateCharacterBodyType(character!.id, "chibi");

  const updated = useDirectorStore.getState().project.objects.find((item) => item.id === character!.id);
  expect(updated?.bodyType).toBe("chibi");
  expect(updated?.color).toBe("#123456");
  expect(updated?.transform.position).toEqual([1, 2, 3]);
});

it("keeps imported local models separate from procedural body types", () => {
  useDirectorStore.setState(createInitialDirectorState());

  useDirectorStore.getState().addImportedAsset({
    kind: "prop",
    name: "本地道具",
    fileName: "cube.obj",
    url: "blob:local-model",
  });

  const imported = useDirectorStore.getState().project.objects.find((item) => item.assetRefId);

  expect(imported?.kind).toBe("prop");
  expect(imported?.bodyType).toBeUndefined();
  expect(imported?.characterRig).toBeUndefined();
});

it("keeps imported model object ids unique after deleting an earlier model", () => {
  useDirectorStore.setState(createInitialDirectorState());

  useDirectorStore.getState().addImportedAsset({
    kind: "prop",
    name: "模型A",
    fileName: "model-a.fbx",
    url: "blob:model-a",
  });
  const firstModelId = useDirectorStore.getState().selectedObjectId;

  useDirectorStore.getState().addImportedAsset({
    kind: "prop",
    name: "模型B",
    fileName: "model-b.fbx",
    url: "blob:model-b",
  });
  const secondModelId = useDirectorStore.getState().selectedObjectId;

  useDirectorStore.getState().selectObject(firstModelId);
  useDirectorStore.getState().deleteSelectedObject();

  useDirectorStore.getState().addImportedAsset({
    kind: "prop",
    name: "模型C",
    fileName: "model-c.fbx",
    url: "blob:model-c",
  });
  const thirdModelId = useDirectorStore.getState().selectedObjectId;
  const modelObjectIds = useDirectorStore
    .getState()
    .project.objects.filter((item) => item.assetRefId)
    .map((item) => item.id);

  expect(thirdModelId).not.toBe(secondModelId);
  expect(modelObjectIds).toHaveLength(2);
  expect(new Set(modelObjectIds).size).toBe(modelObjectIds.length);
});

it("adds a new camera from the current viewport snapshot", () => {
  useDirectorStore.setState(createInitialDirectorState());

  useDirectorStore.getState().addCameraShot({
    fov: 62,
    position: [4, 3, 2],
    target: [0.5, 1.1, -2],
  });

  const state = useDirectorStore.getState();
  const addedCamera = state.project.cameras[state.project.cameras.length - 1];
  const addedObject = state.project.objects.find((item) => item.linkedCameraId === addedCamera?.id);
  const rigPosition = getCameraRigPositionFromViewSnapshot({
    fov: 62,
    position: [4, 3, 2],
    target: [0.5, 1.1, -2],
  });

  expect(addedCamera?.fov).toBe(62);
  expect(addedCamera?.transform.position).toEqual(rigPosition);
  expect(addedCamera?.target).toEqual([0.5, 1.1, -2]);
  expect(addedObject?.transform.position).toEqual(rigPosition);
  expect(state.project.activeCameraId).toBe(addedCamera?.id);
  expect(state.selectedObjectId).toBe(addedObject?.id);
});

it("keeps object-focused cameras centered when the target model moves", () => {
  useDirectorStore.setState(createInitialDirectorState());

  useDirectorStore.getState().addGeometryPrimitive("box");
  const targetObject = useDirectorStore.getState().project.objects.find((item) => item.name === "立方体");
  expect(targetObject).toBeTruthy();

  useDirectorStore.getState().updateCamera("cam_1", {
    targetMode: "object",
    targetObjectId: targetObject!.id,
    target: [-1.725, 0.5, 1.15],
  });
  useDirectorStore.getState().updateObjectTransform(targetObject!.id, { position: [2, 0, -3] });

  const camera = useDirectorStore.getState().project.cameras[0];

  expect(camera.targetMode).toBe("object");
  expect(camera.targetObjectId).toBe(targetObject!.id);
  expect(camera.target).toEqual([2, 0.5, -3]);
});

it("appends camera captures with sequential camera-shot names", () => {
  useDirectorStore.setState(createInitialDirectorState());

  useDirectorStore.getState().addCameraCaptures("cam_1", ["data:image/png;base64,a"]);
  useDirectorStore.getState().addCameraCaptures("cam_1", [
    "data:image/png;base64,b",
    "data:image/png;base64,c",
  ]);

  const camera = useDirectorStore.getState().project.cameras[0];

  expect(camera.captures).toEqual([
    {
      id: "cam_1-capture-01",
      index: 1,
      name: "机位01-截图01",
      dataUrl: "data:image/png;base64,a",
    },
    {
      id: "cam_1-capture-02",
      index: 2,
      name: "机位01-截图02",
      dataUrl: "data:image/png;base64,b",
    },
    {
      id: "cam_1-capture-03",
      index: 3,
      name: "机位01-截图03",
      dataUrl: "data:image/png;base64,c",
    },
  ]);
  expect(camera.lastCaptureUrl).toBe("data:image/png;base64,c");
});

it("auto-persists the latest director scene snapshot after scene changes", () => {
  useDirectorStore.getState().setViewportAspectRatio("16:9");
  useDirectorStore.getState().toggleViewportPanelsCollapsed();
  useDirectorStore.getState().addPresetCharacter("female");
  useDirectorStore.getState().updateScene({ backgroundColor: "#151515" });

  const snapshot = localStorage.getItem("storyai-3d-director-desk-demo");
  expect(snapshot).not.toBeNull();

  const parsed = JSON.parse(snapshot ?? "{}") as {
    viewportAspectRatio?: string;
    viewportPanelsCollapsed?: boolean;
    project?: {
      scene?: {
        backgroundColor?: string;
      };
      objects?: Array<{ id: string; name: string }>;
    };
  };

  expect(parsed.viewportAspectRatio).toBe("16:9");
  expect(parsed.viewportPanelsCollapsed).toBe(true);
  expect(parsed.project?.scene?.backgroundColor).toBe("#151515");
  expect(parsed.project?.objects?.some((item) => item.name === "角色02")).toBe(true);
});

it("keeps persisted director scenes isolated per canvas card instance", () => {
  useDirectorStore.getState().openScopedScene("node_director_a");
  useDirectorStore.getState().setViewportAspectRatio("16:9");
  useDirectorStore.getState().updateScene({ backgroundColor: "#151515" });

  expect(localStorage.getItem("storyai-3d-director-desk-demo:node_director_a")).not.toBeNull();

  useDirectorStore.getState().openScopedScene("node_director_b");

  expect(useDirectorStore.getState().viewportAspectRatio).toBe("auto");
  expect(useDirectorStore.getState().project.scene.backgroundColor).toBe("#000000");

  useDirectorStore.getState().updateScene({ backgroundColor: "#303640" });

  expect(localStorage.getItem("storyai-3d-director-desk-demo:node_director_b")).not.toBeNull();

  useDirectorStore.getState().openScopedScene("node_director_a");

  expect(useDirectorStore.getState().viewportAspectRatio).toBe("16:9");
  expect(useDirectorStore.getState().project.scene.backgroundColor).toBe("#151515");

  useDirectorStore.getState().openScopedScene("node_director_b");

  expect(useDirectorStore.getState().viewportAspectRatio).toBe("auto");
  expect(useDirectorStore.getState().project.scene.backgroundColor).toBe("#303640");
});

it("hydrates the initial state from the persisted director scene snapshot", () => {
  localStorage.setItem(
    "storyai-3d-director-desk-demo",
    JSON.stringify({
      viewMode: "camera",
      selectedObjectId: "char_default_a",
      selectedObjectIds: ["char_default_a"],
      directorInspectorMode: "auto",
      transformMode: "rotate",
      viewportAspectRatio: "9:16",
      viewportRuleOfThirdsEnabled: true,
      viewportPanelsCollapsed: true,
      project: {
        ...createDefaultDirectorProject(),
        scene: {
          ...createDefaultDirectorProject().scene,
          backgroundColor: "#303640",
        },
      },
    })
  );

  const hydratedState = createInitialDirectorState({
    includePersistedLocalAssets: true,
    includePersistedScene: true,
  });

  expect(hydratedState.viewMode).toBe("camera");
  expect(hydratedState.transformMode).toBe("rotate");
  expect(hydratedState.viewportAspectRatio).toBe("9:16");
  expect(hydratedState.viewportRuleOfThirdsEnabled).toBe(true);
  expect(hydratedState.viewportPanelsCollapsed).toBe(true);
  expect(hydratedState.selectedObjectId).toBe("char_default_a");
  expect(hydratedState.project.scene.backgroundColor).toBe("#303640");
});

it("migrates persisted procedural characters to the built-in UE4 mannequin rig", () => {
  const legacyProject = createDefaultDirectorProject();
  const legacyCharacter = legacyProject.objects.find((item) => item.kind === "character");

  if (!legacyCharacter) {
    throw new Error("Expected default character");
  }

  legacyCharacter.color = "#4F8EF7";
  legacyCharacter.transform.position = [1, 0, -2];
  legacyCharacter.characterRig = {
    rigType: "mannequin",
    posePresetId: "stand",
    controls: {
      "head.yaw": 12,
    },
  };

  localStorage.setItem(
    "storyai-3d-director-desk-demo",
    JSON.stringify({
      ...createInitialDirectorState(),
      project: legacyProject,
    })
  );

  const hydratedState = createInitialDirectorState({
    includePersistedScene: true,
  });
  const migratedCharacter = hydratedState.project.objects.find((item) => item.id === legacyCharacter.id);

  expect(migratedCharacter?.transform.position).toEqual([1, 0, -2]);
  expect(migratedCharacter?.color).toBe("#4F8EF7");
  expect(migratedCharacter?.characterRig).toEqual({
    rigType: "ue4-mannequin",
    posePresetId: "stand",
    controls: {
      "head.yaw": 12,
    },
  });
});

it("adds the built-in UE4 mannequin rig to persisted characters that predate rig metadata", () => {
  const legacyProject = createDefaultDirectorProject();
  const legacyCharacter = legacyProject.objects.find((item) => item.kind === "character");

  if (!legacyCharacter) {
    throw new Error("Expected default character");
  }

  delete legacyCharacter.characterRig;

  localStorage.setItem(
    "storyai-3d-director-desk-demo",
    JSON.stringify({
      ...createInitialDirectorState(),
      project: legacyProject,
    })
  );

  const hydratedState = createInitialDirectorState({
    includePersistedScene: true,
  });
  const migratedCharacter = hydratedState.project.objects.find((item) => item.id === legacyCharacter.id);

  expect(migratedCharacter?.characterRig).toEqual({
    rigType: "ue4-mannequin",
    posePresetId: "stand",
    controls: {},
  });
});

it("copies and pastes the current selection as new scene objects", () => {
  useDirectorStore.getState().selectObject("char_default_a");

  useDirectorStore.getState().copySelectedObjects();
  useDirectorStore.getState().pasteClipboardObjects();

  const state = useDirectorStore.getState();
  const characters = state.project.objects.filter((item) => item.kind === "character");
  const pastedCharacter = characters.find((item) => item.id !== "char_default_a");

  expect(characters).toHaveLength(2);
  expect(pastedCharacter?.id).not.toBe("char_default_a");
  expect(pastedCharacter?.transform.position).toEqual([0.6, 0, 0.6]);
  expect(state.selectedObjectId).toBe(pastedCharacter?.id ?? null);
  expect(state.selectedObjectIds).toEqual(pastedCharacter ? [pastedCharacter.id] : []);
});

it("undoes the latest scene mutation", () => {
  useDirectorStore.getState().addPresetCharacter("female");

  expect(useDirectorStore.getState().project.objects.some((item) => item.name === "角色02")).toBe(true);

  useDirectorStore.getState().undo();

  expect(useDirectorStore.getState().project.objects.some((item) => item.name === "角色02")).toBe(false);
  expect(useDirectorStore.getState().project.objects.filter((item) => item.kind === "character")).toHaveLength(1);
});

it("groups repeated transform updates into one undo step while batching", () => {
  useDirectorStore.getState().beginUndoBatch();
  useDirectorStore.getState().updateObjectTransform("char_default_a", { position: [1, 0, 0] });
  useDirectorStore.getState().updateObjectTransform("char_default_a", { position: [2, 0, 0] });
  useDirectorStore.getState().updateObjectTransform("char_default_a", { position: [3, 0, 0] });
  useDirectorStore.getState().endUndoBatch();

  expect(useDirectorStore.getState().project.objects.find((item) => item.id === "char_default_a")?.transform.position).toEqual([
    3, 0, 0,
  ]);

  useDirectorStore.getState().undo();

  expect(useDirectorStore.getState().project.objects.find((item) => item.id === "char_default_a")?.transform.position).toEqual([
    0, 0, 0,
  ]);
});
