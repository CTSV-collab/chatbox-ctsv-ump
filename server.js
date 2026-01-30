const express = require("express");
const fs = require("fs");
const path = require("path");
const stringSimilarity = require("string-similarity");

const app = express();
app.use(express.json());
app.use(express.static(path.join(__dirname, "public")));

app.get("/", (req, res) => {
  res.sendFile(path.join(__dirname, "public", "index.html"));
});

/* =====================
   NORMALIZE TIẾNG VIỆT
===================== */
function normalize(text = "") {
  return text
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^\w\s]/g, "")
    .trim();
}

/* =====================
   LOAD DATA
===================== */
function loadData() {
  const dataDir = path.join(__dirname, "data");
  let intents = [];

  fs.readdirSync(dataDir).forEach(file => {
    if (!file.endsWith(".json")) return;

    try {
      const raw = fs.readFileSync(path.join(dataDir, file), "utf8");
      const data = JSON.parse(raw);

      if (!Array.isArray(data)) return;

      data.forEach(item => {
        if (!item.questions || !item.answer) {
          console.warn(`⚠️ Bỏ qua item lỗi trong ${file}`);
          return;
        }
        intents.push(item);
      });
    } catch (err) {
      console.error(`❌ Lỗi file ${file}:`, err.message);
    }
  });

  return intents;
}

const intents = loadData();
console.log(`📚 Đã load ${intents.length} intent`);

/* =====================
   LOG LOCAL (JSON)
===================== */
const logDir = path.join(__dirname, "logs");
const logPath = path.join(logDir, "chat-log.json");

function logQuestion(questionRaw) {
  if (!questionRaw) return;

  if (!fs.existsSync(logDir)) {
    fs.mkdirSync(logDir);
  }

  let logs = [];
  if (fs.existsSync(logPath)) {
    logs = JSON.parse(fs.readFileSync(logPath, "utf8") || "[]");
  }

  logs.push({
    time: new Date().toISOString(),
    question: questionRaw
  });

  fs.writeFileSync(logPath, JSON.stringify(logs, null, 2));
  console.log("📝 Logged question:", questionRaw);
}

/* =====================
   CHAT API
===================== */
app.post("/chat", async (req, res) => {
  console.log("🔥 /chat API CALLED");

  const questionRaw = req.body.question;
  if (!questionRaw) {
    return res.json({ answer: "⚠️ Không nhận được câu hỏi." });
  }

  // ✅ LOG LOCAL DUY NHẤT
  logQuestion(questionRaw);

  const question = normalize(questionRaw);
  let bestMatch = null;
  let bestScore = 0;

  intents.forEach(intent => {
    intent.questions.forEach(q => {
      const score = stringSimilarity.compareTwoStrings(
        question,
        normalize(q)
      );

      if (score > bestScore) {
        bestScore = score;
        bestMatch = intent;
      }
    });
  });

  console.log({
    question: questionRaw,
    score: bestScore.toFixed(3),
    intent: bestMatch?.intent || "NO_MATCH"
  });

  if (bestMatch && bestScore >= 0.35) {
    return res.json({ answer: bestMatch.answer });
  }

  return res.json({
    answer:
      "🤔 Mình chưa chắc chắn câu hỏi này. Bạn có thể hỏi theo cách khác hoặc liên hệ trực tiếp Phòng CTSV nhé!"
  });
});

/* =====================
   START SERVER
===================== */
const PORT = process.env.PORT || 3001;
app.listen(PORT, () => {
  console.log("🤖 Chatbot CTSV chạy tại port", PORT);
});