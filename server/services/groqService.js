const Groq = require("groq-sdk");

const groq = new Groq({
  apiKey: "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",
});

async function getGroqChatCompletion({ subject, subtopic }) {
  return groq.chat.completions.create({
    messages: [
      {
        role: "user",
        content: `
          Generate 10 multiple-choice questions (MCQs) for the subject "${subject}" and subtopic "${subtopic}". 
          Format them as:
          Question: [question text]
          Options:
          a. [option 1]
          b. [option 2]
          c. [option 3]
          d. [option 4]
          Correct Answer: [correct option]
          Respond only in this format without any extra text or greetings.
          `,
      },
    ],
    model: "llama3-8b-8192",
  });
}
async function getGroqChatCompletionGoal({ previousResponses }) {
    // Validate input
    if (!Array.isArray(previousResponses)) {
      throw new Error("Invalid input: 'previousResponses' must be an array.");
    }
  
    previousResponses.forEach((response, index) => {
      if (typeof response !== "string") {
        throw new Error(`Invalid input at index ${index}: Each response must be a string.`);
      }
    });
  
    // Prepare conversation context
    const messages = [
      {
        role: "system",
        content: "You are an educational bot that helps users plan their learning journey by asking personalized questions.",
      },
    ];
  
    if (previousResponses.length === 0) {
      // First question
      messages.push({
        role: "assistant",
        content: "What's your main learning goal?",
      });
    } else {
      // Add user responses to conversation history
      previousResponses.forEach((response, index) => {
        messages.push({
          role: "user",
          content: response,
        });
  
        // Optionally add assistant's acknowledgment for previous responses
        if (index < previousResponses.length - 1) {
          messages.push({
            role: "assistant",
            content: `Thank you for your response to question ${index + 1}.`,
          });
        }
      });
  
      // Generate the next question based on the last response
      const lastResponse = previousResponses[previousResponses.length - 1];
      messages.push({
        role: "assistant",
        content: `Based on your response, "${lastResponse}", here's the next question:`,
      });
    }
  
    try {
      // Call Groq API
      const completion = await groq.chat.completions.create({
        messages,
        model: "llama3-8b-8192",
      });
  
      // Extract the last AI-generated message
      const aiResponse = completion.messages[completion.messages.length - 1];
      return {
        question: aiResponse.content,
        complete: previousResponses.length >= 4, // Mark complete after 5 questions
      };
    } catch (error) {
      console.error("Error generating question with Groq API:", error);
      throw new Error("Failed to generate question using Groq AI.");
    }
  }

async function generateRoadmap(goal, duration) {
  const groq = new Groq({
    apiKey: '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'
  });

  const prompt = `Generate a learning roadmap for the goal: "${goal}" with duration "${duration}".
  Return ONLY a JSON object with this exact structure (no additional text):
  {
    "basics": [
      {
        "topic": "string",
        "description": "string"
      }
    ],
    "learningPath": [
      {
        "phase": "string",
        "description": "string",
        "duration": "string",
        "tasks": ["string"]
      }
    ],
    "resources": {
      "videos": [
        {
          "title": "string",
          "url": "string",
          "platform": "string"
        }
      ],
      "courses": [
        {
          "title": "string",
          "url": "string",
          "platform": "string",
          "isPaid": boolean
        }
      ],
      "books": [
        {
          "title": "string",
          "author": "string",
          "description": "string"
        }
      ]
    }
  }`;

  try {
    const completion = await groq.chat.completions.create({
      messages: [
        { 
          role: "system", 
          content: "You are a JSON API that only returns valid JSON objects. Never include explanatory text or markdown."
        },
        { 
          role: "user", 
          content: prompt 
        }
      ],
      model: "llama3-8b-8192",
      temperature: 0.7,
      max_tokens: 2048,
    });

    const content = completion.choices[0]?.message?.content;
    
    if (!content) {
      throw new Error('No content received from AI');
    }

    try {
      // Try to parse the JSON response
      const roadmapData = JSON.parse(content);
      
      // Validate the required structure
      if (!roadmapData.basics || !roadmapData.learningPath || !roadmapData.resources) {
        throw new Error('Invalid roadmap structure');
      }

      return roadmapData;
    } catch (parseError) {
      console.error('JSON Parse Error:', parseError);
      console.error('Raw Content:', content);
      
      // Return a default structure if parsing fails
      return {
        basics: [
          {
            topic: "Getting Started",
            description: "Understanding the fundamentals"
          }
        ],
        learningPath: [
          {
            phase: "Phase 1",
            description: "Initial Learning",
            duration: duration,
            tasks: ["Start with basics"]
          }
        ],
        resources: {
          videos: [],
          courses: [],
          books: []
        }
      };
    }
  } catch (error) {
    console.error('Groq API Error:', error);
    throw new Error('Failed to generate roadmap');
  }
}

module.exports = {
  getGroqChatCompletion, getGroqChatCompletionGoal, generateRoadmap
};
