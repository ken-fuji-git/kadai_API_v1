import { ObjectDetector, FilesetResolver } 
  from "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.2";

let objectDetector = null;
let runningMode = "IMAGE";

// MediaPipe ObjectDetector 初期化（公式ガイドの wasm/model URL）  [oai_citation:12‡Google AI for Developers](https://ai.google.dev/edge/mediapipe/solutions/vision/object_detector/web_js)
async function initDetector() {
  const vision = await FilesetResolver.forVisionTasks(
    "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@latest/wasm"
  );

  objectDetector = await ObjectDetector.createFromOptions(vision, {
    baseOptions: {
      modelAssetPath:
        "https://storage.googleapis.com/mediapipe-tasks/object_detector/efficientdet_lite0_uint8.tflite"
    },
    scoreThreshold: 0.5,
    runningMode
  });
}

function resetUI() {
  $("#preview").attr("src", "");
  $("#imageArea").addClass("empty");
  $("#labelText").text("-");
  $("#punText").text("-");
}

// 画像を読み込んで img 要素に表示
function loadImageToPreview(file) {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const img = document.getElementById("preview");
    img.onload = () => resolve(img);
    img.onerror = reject;
    img.src = url;
  });
}

// MediaPipeでラベル抽出（最も確信度が高い categoryName を採用）
function detectTopLabel(imgEl) {
  const result = objectDetector.detect(imgEl); // 画像用の同期処理（ガイドでも言及）  [oai_citation:13‡Google Codelabs](https://codelabs.developers.google.com/mp-object-detection-web)
  const detections = result?.detections || [];
  if (detections.length === 0) return "";

  // 一番目の検出、さらにその一番目カテゴリを採用（最小実装）
  const c = detections[0]?.categories?.[0];
  return c?.categoryName || "";
}

// Functions(/api)へ送ってダジャレ取得
async function fetchPun(label) {
  const r = await fetch("/api", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ label })
  });
  if (!r.ok) {
    const t = await r.text();
    throw new Error(t);
  }
  return await r.json();
}

$(async function () {
  resetUI();

  // 先にモデルをロード
  $("#punText").text("モデルを読み込み中…");
  await initDetector();
  $("#punText").text("-");

  $("#clearBtn").on("click", resetUI);

  $("#fileInput").on("change", async function (e) {
    try {
      const file = e.target.files?.[0];
      if (!file) return;

      $("#punText").text("画像を読み込み中…");
      const imgEl = await loadImageToPreview(file);
      $("#imageArea").removeClass("empty");

      $("#punText").text("画像を解析中…");
      const label = detectTopLabel(imgEl);
      $("#labelText").text(label || "(検出できませんでした)");

      if (!label) {
        $("#punText").text("別の画像で試してください");
        return;
      }

      $("#punText").text("ダジャレ生成中…");
      const data = await fetchPun(label);
      $("#punText").text(data.pun || "(結果なし)");
    } catch (err) {
      $("#punText").text("エラー: " + String(err));
    }
  });
});