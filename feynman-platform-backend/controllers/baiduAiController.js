const AppError = require("../utils/appError");
const DeepseekUtil = require("../utils/openai");
// controllers/baiduAiController.js
const AipSpeechClient = require("baidu-aip-sdk").speech;
const fs = require("fs");
const path = require("path");

// 从环境变量中获取凭证
const APP_ID = process.env.BAIDU_APP_ID;
const API_KEY = process.env.BAIDU_API_KEY;
const SECRET_KEY = process.env.BAIDU_SECRET_KEY;

// 新建一个AipSpeechClient对象
const client = new AipSpeechClient(APP_ID, API_KEY, SECRET_KEY);

exports.transcribeAudio = async (req, res, next) => {
  if (!req.file) {
    return res.status(400).json({ msg: "No audio file uploaded." });
  }

  // req.file.buffer 包含了音频文件的二进制数据
  const audioBuffer = req.file.buffer;
  const audioDir = path.join(__dirname, "../audio");
  if (!fs.existsSync(audioDir)) {
    fs.mkdirSync(audioDir, { recursive: true });
  }

  try {
    const timestamp = Date.now();
    const randomString = Math.random().toString(36).substring(2, 8);
    const filename = `audio_${timestamp}_${randomString}.wav`;
    const filePath = path.join(audioDir, filename);

    // 保存音频文件到 audio 文件夹
    fs.writeFileSync(filePath, audioBuffer);
    console.log(`音频文件已保存: ${filePath}`);
    // 调用语音识别短语音版
    // 'wav' 是文件格式, 16000 是采样率, dev_pid: 1537 是普通话模型
    console.log("音频数据长度：", audioBuffer ? audioBuffer.length : "无数据");
    const result = await client.recognize(audioBuffer, "wav", 16000, {
      dev_pid: 1537,
    });
    console.log("ERROR ID IS : " + result);
    console.log("Baidu ASR Result:", result);

    // 检查返回结果
    if (result.err_no === 0) {
      // 成功
      res.json({
        code: 0,
        msg: "转录成功",
        result: result.result[0],
      });
    } else {
      // 失败
      throw new AppError(
        `Baidu ASR error: ${result.err_msg} (code: ${result.err_no})`
      );
    }
  } catch (error) {
    //next(error);
    console.error("Error calling Baidu ASR API:", error);
    res.status(500).send("Server error during transcription.");
  }
};

const axios = require("axios");
// ... AipSpeechClient and other code ...

// --- 大模型相关 ---

// AI润色与评价的核心函数
exports.evaluateFeynmanAttempt = async (req, res) => {
  const { originalContent, transcribedText } = req.body;

  console.log("Received evaluate request:", {
    originalContent,
    transcribedText,
  });

  if (!originalContent || !transcribedText) {
    console.log("Missing parameters:", { originalContent, transcribedText });
    return res
      .status(400)
      .json({ msg: "Original content and transcribed text are required." });
  }

  try {
    // --- 精心设计的Prompt ---
    const prompt = `
        你是一个严格而友善的计算机科学学习教练。你的任务是评估学生对一个知识点的复述，并给出反馈。

        【原始知识点】:
        \`\`\`
        ${originalContent}
        \`\`\`

        【学生的口头复述文本】:
        \`\`\`
        ${transcribedText}
        \`\`\`

        请你完成以下三项任务:
        1.  **文本润色**: 将学生的复述文本润色成一段通顺、专业、书面化的文字。修正明显的语法错误和口语化表达，但保持其核心观点不变。
        2.  **综合评价**: 基于原始知识点，对学生的复述进行评价。指出其优点和可以改进的地方。
        3.  **评分**: 综合考虑准确性、完整性、逻辑性和流畅性，给出一个0到100的整数分数。

        请严格按照以下JSON格式返回你的结果，不要包含任何额外的解释或文字。
        {
          "polishedText": "这里是润色后的文本",
          "evaluation": "这里是你的综合评价",
          "strengths": ["优点1", "优点2"],
          "weaknesses": ["可以改进的地方1", "可以改进的地方2"],
          "score": 85
        }
        `;
    const response = await DeepseekUtil.quickChat(transcribedText, prompt);
    // 解析LLM返回的JSON字符串
    const llmResult = JSON.parse(response);
    res.json(llmResult);
  } catch (error) {
    console.error(
      "Error calling LLM API:",
      error.response ? error.response.data : error.message
    );
    res.status(500).send("Server error during AI evaluation.");
  }
};
