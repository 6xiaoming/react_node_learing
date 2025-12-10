const { PromptTemplate } = require("@langchain/core/prompts");
const { StringOutputParser } = require("@langchain/core/output_parsers");
const { ChatDeepSeek } = require("@langchain/deepseek");
const { RunnableSequence } = require("@langchain/core/runnables");
const { HNSWLib } = require("@langchain/community/vectorstores/hnswlib");
const { queryVectorStore } = require('../services/embedding_kp');

// 这里写一个单独的AI Agent服务吧， 我也不知放哪里
// 困惑
// // 初始化千帆(qianfan is bullshit)的聊天模型
const chatModel = new ChatDeepSeek({
    model: "deepseek-chat", // 推荐使用 Deepseek 的聊天模型
    // LangChain 会自动查找 DEEPSEEK_API_KEY 环境变量
    // 您也可以显式传入：deepseekApiKey: process.env.DEEPSEEK_API_KEY,
});
exports.answerWithRAG = async (req, res) => {
    const { question } = req.body || {};
    if (!question) {
        return res.status(400).json({
            code: 400,
            msg: "question is required in request body"
        });
    }

    try {

        // 1. [进阶] 定义遵循大模型上下文协议 (MCP) 的Prompt模板
        // 讲解：MCP是一种向大模型高效、清晰地传递信息的“最佳实践”。
        // 它通过类似XML的标签，明确地告诉模型各部分内容的角色（比如，这是背景资料，这是用户的问题）。
        // 这样做能显著减少歧义，让模型更好地理解任务，从而给出更精确的回答。
        const promptTemplate = PromptTemplate.fromTemplate(
            `<role>你是一个知识库问答机器人。</role>\n` +
            `<instruction>请根据下面提供的<context>信息来回答用户的<question>。如果上下文中没有相关信息，就明确说你不知道，不要编造答案。请让回答简洁明了。</instruction>\n\n` +
            `<context>\n{context}\n</context>\n\n` +
            `<question>\n{question}\n</question>\n\n` +
            `<answer>你的回答是：</answer>`
        );

        // 2. 加载向量数据库并创建检索器
        const relevantDocs = await queryVectorStore(question)

        // 3. 定义一个函数来格式化检索到的文档
        const formatDocs = (docs) => {
            return docs.map((doc, i) => `--- 文档 ${i + 1} ---\n${doc.pageContent}`).join("\n\n");
        };

        // 4. 使用 LCEL 构建 RAG 链
        // 3. 使用 LCEL 构建 RAG 链
        const ragChain = RunnableSequence.from([
            // LCEL 输入映射：将检索到的文档和问题格式化
            {
                context: (input) => formatDocs(input.docs), // 使用 docs 字段
                question: (input) => input.question,
            },
            // 填充模板
            promptTemplate,
            // 调用 LLM
            chatModel,
            // 解析输出
            new StringOutputParser(),
        ]);

        // 4. 执行链：同时传入问题和检索到的文档
        const answer = await ragChain.invoke({
            question,
            docs: relevantDocs
        });

        res.json({ answer });

    } catch (error) {
        console.error('RAG Chain execution error:', error);
        res.status(500).send('Error answering question with RAG.');
    }
};