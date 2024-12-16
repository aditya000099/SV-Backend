const parseMCQs = (rawText) => {
  const mcqs = [];
  const questions = rawText.split("Question: ").slice(1);

  questions.forEach((q) => {
    const [question, optionsAndAnswer] = q.split("Options:");
    const [optionsText, correctAnswerLine] = optionsAndAnswer.split("Correct Answer:");
    const correctAnswer = correctAnswerLine.trim();
    const options = {};

    optionsText
      .trim()
      .split("\n")
      .forEach((line) => {
        const [key, value] = line.split(". ");
        options[key.trim()] = value.trim();
      });

    mcqs.push({
      question: question.trim(),
      options,
      correctAnswer,
    });
  });

  return mcqs;
};

module.exports = { parseMCQs }; 