// utils/DeepSeekUtil.js
const OpenAI = require("openai");

class DeepSeekUtil {
  constructor() {
    this.client = new OpenAI({
      baseURL: 'https://api.deepseek.com',
      apiKey: process.env.DEEPSEEK_API_KEY,
    });
  }

  /**
   * 发送聊天消息
   * @param {Array} messages - 消息数组
   * @param {Object} options - 额外选项
   * @returns {Promise<Object>} 响应结果
   */
  async chat(messages, options = {}) {
    try {
      const completion = await this.client.chat.completions.create({
        messages: messages,
        model: options.model || "deepseek-chat",
        temperature: options.temperature || 0.7,
        max_tokens: options.max_tokens || 2000,
        stream: options.stream || false,
        ...options
      });

      return {
        success: true,
        data: completion.choices[0].message,
        usage: completion.usage,
        fullResponse: completion
      };
    } catch (error) {
      console.error('DeepSeek API Error:', error);
      return {
        success: false,
        error: error.message,
        code: error.code || 'UNKNOWN_ERROR'
      };
    }
  }

  /**
   * 快速单次对话
   * @param {string} content - 用户消息内容
   * @param {string} systemMessage - 系统提示词
   * @returns {Promise<string>} 助手回复内容
   */
  async quickChat(content, systemMessage = "You are a helpful assistant.") {
    const messages = [
      { role: "system", content: systemMessage },
      { role: "user", content: content }
    ];

    const result = await this.chat(messages);
    
    if (result.success) {
      return result.data.content;
    } else {
      throw new Error(`DeepSeek API Error: ${result.error}`);
    }
  }

  /**
   * 流式对话
   * @param {Array} messages - 消息数组
   * @param {Function} onMessage - 消息回调函数
   * @param {Object} options - 额外选项
   */
  async streamChat(messages, onMessage, options = {}) {
    try {
      const stream = await this.client.chat.completions.create({
        messages: messages,
        model: options.model || "deepseek-chat",
        stream: true,
        temperature: options.temperature || 0.7,
        max_tokens: options.max_tokens || 2000,
        ...options
      });

      let fullContent = '';
      
      for await (const chunk of stream) {
        const content = chunk.choices[0]?.delta?.content || '';
        fullContent += content;
        
        if (onMessage) {
          onMessage(content, fullContent, chunk);
        }
      }

      return {
        success: true,
        content: fullContent
      };
    } catch (error) {
      console.error('DeepSeek Stream Error:', error);
      return {
        success: false,
        error: error.message
      };
    }
  }

  /**
   * 批量处理消息
   * @param {Array} messageList - 消息列表
   * @returns {Promise<Array>} 处理结果数组
   */
  async batchChat(messageList) {
    const promises = messageList.map(async (item) => {
      const result = await this.chat(item.messages, item.options);
      return {
        input: item,
        output: result
      };
    });

    return Promise.all(promises);
  }
}

// 创建单例实例
const deepSeekUtil = new DeepSeekUtil();

module.exports = deepSeekUtil;