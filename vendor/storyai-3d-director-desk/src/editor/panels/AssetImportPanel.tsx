import { useState } from "react";
import { readLocalModelFile } from "../loaders/localModelImport";
import { readPanoramaFile } from "../loaders/panoramaImport";
import { useDirectorStore } from "../store/directorStore";

export function AssetImportPanel() {
  const addImportedAsset = useDirectorStore((state) => state.addImportedAsset);
  const assets = useDirectorStore((state) => state.project.assets);
  const panoramaAssetId = useDirectorStore((state) => state.project.panoramaAssetId);
  const [importError, setImportError] = useState<string | null>(null);

  const latestLocalModel = [...assets].reverse().find((item) => item.kind !== "panorama");
  const panoramaAsset = assets.find((item) => item.id === panoramaAssetId);

  async function handleLocalModel(file: File) {
    setImportError(null);
    const result = await readLocalModelFile(file);
    addImportedAsset({ kind: "prop", ...result });
  }

  async function handlePanorama(file: File) {
    setImportError(null);
    const result = await readPanoramaFile(file);
    addImportedAsset({ kind: "panorama", ...result });
  }

  return (
    <section className="panel-card">
      <h2>导入</h2>
      <label className="asset-import-item">
        导入本地模型
        <input
          aria-label="导入本地模型"
          accept=".fbx,.obj"
          type="file"
          onChange={async (event) => {
            const input = event.currentTarget;
            const file = input.files?.[0];
            if (!file) return;
            try {
              await handleLocalModel(file);
            } catch (error) {
              setImportError(error instanceof Error ? error.message : "本地模型导入失败");
            } finally {
              input.value = "";
            }
          }}
        />
        <p className="asset-import-status">
          {latestLocalModel ? `已导入本地模型: ${latestLocalModel.fileName}` : "支持 FBX / OBJ 素模文件"}
        </p>
      </label>
      <label className="asset-import-item">
        导入全景图
        <input
          aria-label="导入全景图"
          accept=".jpg,.jpeg,.png,.webp"
          type="file"
          onChange={async (event) => {
            const input = event.currentTarget;
            const file = input.files?.[0];
            if (!file) return;
            try {
              await handlePanorama(file);
            } catch (error) {
              setImportError(error instanceof Error ? error.message : "全景图导入失败");
            } finally {
              input.value = "";
            }
          }}
        />
        <p className="asset-import-status">
          {panoramaAsset ? `已导入全景图: ${panoramaAsset.fileName}` : "支持 JPG / PNG / WEBP，普通图片会自动适配为全景背景"}
        </p>
      </label>
      {importError ? <p className="capture-status">{importError}</p> : null}
    </section>
  );
}
