const generateNextQuestion = (responses) => {
  if (responses.length === 0) {
    return "What is your primary learning goal?";
  } else if (responses.length === 1) {
    return "How much time can you dedicate daily?";
  } else if (responses.length === 2) {
    return "What resources do you have access to (books, internet, mentors)?";
  }
  return null;
};

const getNextQuestion = (req, res) => {
  const { previousResponses } = req.body;

  const nextQuestion = generateNextQuestion(previousResponses);

  if (nextQuestion) {
    return res.json({ question: nextQuestion, complete: false });
  }

  return res.json({ complete: true });
};

const generateRoadmap = (req, res) => {
  const { responses, userId } = req.body;

  const roadmap = {
    mainGoal: responses[0]?.answer || "Undefined Goal",
    timeline: "3 months",
    minimumTime: responses[1]?.answer || "30 minutes daily",
    milestones: [
      "Complete foundational concepts",
      "Build a small project",
      "Master advanced topics",
    ],
    resources: [
      { title: "FreeCodeCamp", url: "https://freecodecamp.org" },
      { title: "Khan Academy", url: "https://khanacademy.org" },
    ],
  };

  res.json(roadmap);
};

module.exports = {
  getNextQuestion,
  generateRoadmap
}; 