import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, vi } from "vitest";
import { createInitialDirectorState, useDirectorStore } from "../store/directorStore";
import { AssetImportPanel } from "./AssetImportPanel";

const drawImageMock = vi.fn();

beforeEach(() => {
  useDirectorStore.setState({
    ...useDirectorStore.getState(),
    ...createInitialDirectorState(),
  });
  vi.stubGlobal("URL", {
    ...URL,
    createObjectURL: vi.fn(() => "blob:uploaded"),
  });
  vi.stubGlobal(
    "createImageBitmap",
    vi.fn(async () => ({
      width: 4096,
      height: 2048,
      close: vi.fn(),
    }))
  );
  vi.spyOn(HTMLCanvasElement.prototype, "getContext").mockImplementation(
    () =>
      ({
        save: vi.fn(),
        restore: vi.fn(),
        fillRect: vi.fn(),
        drawImage: drawImageMock,
        createLinearGradient: vi.fn(() => ({
          addColorStop: vi.fn(),
        })),
        filter: "none",
        fillStyle: "#000000",
      }) as unknown as CanvasRenderingContext2D
  );
  vi.spyOn(HTMLCanvasElement.prototype, "toDataURL").mockImplementation(() => "data:image/jpeg;base64,panorama-adapted");
  drawImageMock.mockReset();
});

it("imports a local OBJ/FBX model from the single local model entry", async () => {
  const user = userEvent.setup();
  render(<AssetImportPanel />);

  expect(screen.getByText("导入本地模型")).toBeInTheDocument();
  expect(screen.queryByText("导入角色模型")).not.toBeInTheDocument();
  expect(screen.queryByText("导入场景模型")).not.toBeInTheDocument();
  expect(screen.queryByText("导入道具模型")).not.toBeInTheDocument();

  const input = screen.getByLabelText("导入本地模型");
  expect(input).toHaveAttribute("accept", ".fbx,.obj");

  const file = new File(["demo"], "football.obj", { type: "model/obj" });
  await user.upload(input, file);

  await waitFor(() => {
    expect(
      useDirectorStore.getState().project.objects.some((item) => item.name === "football")
    ).toBe(true);
  });

  const latestAsset =
    useDirectorStore.getState().project.assets[useDirectorStore.getState().project.assets.length - 1];
  expect(latestAsset?.fileName).toBe("football.obj");
  expect(screen.getByText("已导入本地模型: football.obj")).toBeInTheDocument();
});

it("imports a panorama image and shows the connected panorama file", async () => {
  const user = userEvent.setup();
  render(<AssetImportPanel />);

  expect(screen.getByLabelText("导入全景图")).toHaveAttribute("accept", ".jpg,.jpeg,.png,.webp");

  const file = new File(["image"], "studio-360.jpg", { type: "image/jpeg" });
  await user.upload(screen.getByLabelText("导入全景图"), file);

  await waitFor(() => {
    expect(useDirectorStore.getState().project.panoramaAssetId).toBe("asset_1");
  });

  expect(useDirectorStore.getState().project.assets[0]?.fileName).toBe("studio-360.jpg");
  expect(screen.getByText("已导入全景图: studio-360.jpg")).toBeInTheDocument();
});

it("imports a non-2:1 image as a backdrop sphere texture", async () => {
  vi.stubGlobal(
    "createImageBitmap",
    vi.fn(async () => ({
      width: 2752,
      height: 1536,
      close: vi.fn(),
    }))
  );

  const user = userEvent.setup();
  render(<AssetImportPanel />);

  const file = new File(["image"], "stadium.jpg", { type: "image/jpeg" });
  await user.upload(screen.getByLabelText("导入全景图"), file);

  await waitFor(() => {
    expect(useDirectorStore.getState().project.panoramaAssetId).toBe("asset_1");
  });

  expect(useDirectorStore.getState().project.assets[0]?.url).toBe("data:image/jpeg;base64,panorama-adapted");
  expect(useDirectorStore.getState().project.assets[0]?.projectionMode).toBe("backdrop");
  expect(screen.getByText("已导入全景图: stadium.jpg")).toBeInTheDocument();
});

it("scales non-2:1 images to cover the panorama canvas before seam optimization", async () => {
  vi.stubGlobal(
    "createImageBitmap",
    vi.fn(async () => ({
      width: 2752,
      height: 1536,
      close: vi.fn(),
    }))
  );

  const user = userEvent.setup();
  render(<AssetImportPanel />);

  const file = new File(["image"], "stadium.jpg", { type: "image/jpeg" });
  await user.upload(screen.getByLabelText("导入全景图"), file);

  await waitFor(() => {
    expect(useDirectorStore.getState().project.panoramaAssetId).toBe("asset_1");
  });

  expect(drawImageMock).toHaveBeenCalledTimes(1);

  const placementDraw = drawImageMock.mock.calls[0];
  expect(placementDraw?.[1]).toBeCloseTo(0, 0);
  expect(placementDraw?.[2]).toBeLessThan(0);
  expect(placementDraw?.[3]).toBeCloseTo(3072, 0);
  expect(placementDraw?.[4]).toBeGreaterThan(1536);
});
