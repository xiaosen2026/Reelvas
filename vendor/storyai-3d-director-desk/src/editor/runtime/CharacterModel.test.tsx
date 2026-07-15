import { render, screen } from "@testing-library/react";
import { vi } from "vitest";
import { CharacterModel } from "./CharacterModel";

vi.mock("./UE4MannequinModel", () => ({
  UE4MannequinModel: ({ bodyType }: { bodyType?: string }) => (
    <div data-body-type={bodyType} data-testid="mock-ue4-mannequin" />
  ),
}));

vi.mock("./PrimitiveMannequin", () => ({
  PrimitiveMannequin: ({ bodyType }: { bodyType?: string }) => (
    <div data-body-type={bodyType} data-testid="mock-procedural-mannequin" />
  ),
}));

it("renders the built-in UE4 mannequin for generated director characters", () => {
  render(
    <CharacterModel
      bodyType="female"
      rigState={{
        rigType: "ue4-mannequin",
        posePresetId: "stand",
        controls: {},
      }}
    />
  );

  expect(screen.getByTestId("mock-ue4-mannequin")).toHaveAttribute("data-body-type", "female");
  expect(screen.queryByTestId("mock-procedural-mannequin")).not.toBeInTheDocument();
});

it("keeps the procedural mannequin fallback for non-UE4 rigs", () => {
  render(
    <CharacterModel
      bodyType="chibi"
      rigState={{
        rigType: "mannequin",
        posePresetId: "stand",
        controls: {},
      }}
    />
  );

  expect(screen.getByTestId("mock-procedural-mannequin")).toHaveAttribute("data-body-type", "chibi");
  expect(screen.queryByTestId("mock-ue4-mannequin")).not.toBeInTheDocument();
});
