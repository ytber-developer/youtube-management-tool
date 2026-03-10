/**
 * Comment Helper - Generate random YouTube comments
 * Loads comments from comments.json and provides utilities for random selection
 */

const fs = require('fs');
const path = require('path');

class CommentHelper {
  constructor() {
    this.comments = null;
    this.commentsPath = path.join(__dirname, '../../comments.json');
  }

  /**
   * Load comments from JSON file
   */
  loadComments() {
    if (this.comments) {
      return this.comments;
    }

    try {
      const data = fs.readFileSync(this.commentsPath, 'utf-8');
      this.comments = JSON.parse(data);
      console.log(`✅ Loaded ${this.comments.comments.length} comments from file`);
      return this.comments;
    } catch (error) {
      console.error('❌ Failed to load comments.json:', error.message);
      
      // Fallback to basic comments if file not found
      this.comments = {
        comments: [
          { text: 'Great video!', category: 'positive', language: 'en' },
          { text: 'Thanks for sharing!', category: 'positive', language: 'en' },
          { text: 'Very helpful!', category: 'positive', language: 'en' },
          { text: 'Nice work!', category: 'positive', language: 'en' },
          { text: 'Awesome content!', category: 'positive', language: 'en' },
        ],
      };
      
      return this.comments;
    }
  }

  /**
   * Get random comment from list
   * @param {Object} options - Filter options
   * @param {string} options.category - Filter by category (positive, neutral, question, etc.)
   * @param {string} options.language - Filter by language (en, emoji)
   * @returns {string} Random comment text
   */
  getRandomComment(options = {}) {
    const data = this.loadComments();
    let commentPool = [...data.comments];

    // Filter by category if specified
    if (options.category) {
      commentPool = commentPool.filter(c => c.category === options.category);
    }

    // Filter by language if specified
    if (options.language) {
      commentPool = commentPool.filter(c => c.language === options.language);
    }

    // Fallback if no comments match filter
    if (commentPool.length === 0) {
      commentPool = data.comments;
    }

    // Pick random comment
    const randomComment = commentPool[Math.floor(Math.random() * commentPool.length)];
    return randomComment.text;
  }

  /**
   * Generate comment from template with variables
   * @returns {string} Generated comment
   */
  generateFromTemplate() {
    const data = this.loadComments();
    
    if (!data.comment_templates || !data.variables) {
      return this.getRandomComment();
    }

    // Pick random template
    const template = data.comment_templates[
      Math.floor(Math.random() * data.comment_templates.length)
    ];

    // Replace variables in template
    let comment = template;
    
    // Replace {adjective}
    if (comment.includes('{adjective}')) {
      const adjective = data.variables.adjective[
        Math.floor(Math.random() * data.variables.adjective.length)
      ];
      comment = comment.replace('{adjective}', adjective);
    }

    // Replace {emotion}
    if (comment.includes('{emotion}')) {
      const emotion = data.variables.emotion[
        Math.floor(Math.random() * data.variables.emotion.length)
      ];
      comment = comment.replace('{emotion}', emotion);
    }

    // Replace {action}
    if (comment.includes('{action}')) {
      const action = data.variables.action[
        Math.floor(Math.random() * data.variables.action.length)
      ];
      comment = comment.replace('{action}', action);
    }

    // Replace {greeting}
    if (comment.includes('{greeting}')) {
      const greeting = data.variables.greeting[
        Math.floor(Math.random() * data.variables.greeting.length)
      ];
      comment = comment.replace('{greeting}', greeting);
    }

    // Replace {feedback}
    if (comment.includes('{feedback}')) {
      const feedback = data.variables.feedback[
        Math.floor(Math.random() * data.variables.feedback.length)
      ];
      comment = comment.replace('{feedback}', feedback);
    }

    return comment;
  }

  /**
   * Get random question comment
   * @returns {string} Question comment
   */
  getRandomQuestion() {
    const data = this.loadComments();
    
    if (!data.question_comments || data.question_comments.length === 0) {
      return 'How did you do this?';
    }

    let question = data.question_comments[
      Math.floor(Math.random() * data.question_comments.length)
    ];

    // Replace {timestamp} with random time
    if (question.includes('{timestamp}')) {
      const minutes = Math.floor(Math.random() * 10);
      const seconds = Math.floor(Math.random() * 60);
      const timestamp = `${minutes}:${seconds.toString().padStart(2, '0')}`;
      question = question.replace('{timestamp}', timestamp);
    }

    // Replace {topic} with generic topic
    if (question.includes('{topic}')) {
      const topics = ['this', 'that technique', 'the method you used', 'similar topics'];
      const topic = topics[Math.floor(Math.random() * topics.length)];
      question = question.replace('{topic}', topic);
    }

    return question;
  }

  /**
   * Get random specific praise comment
   * @returns {string} Specific praise comment
   */
  getRandomPraise() {
    const data = this.loadComments();
    
    if (!data.specific_praise || data.specific_praise.length === 0) {
      return this.getRandomComment({ category: 'positive' });
    }

    return data.specific_praise[
      Math.floor(Math.random() * data.specific_praise.length)
    ];
  }

  /**
   * Get random engagement comment
   * @returns {string} Engagement comment
   */
  getRandomEngagement() {
    const data = this.loadComments();
    
    if (!data.engagement_comments || data.engagement_comments.length === 0) {
      return this.getRandomComment({ category: 'positive' });
    }

    let comment = data.engagement_comments[
      Math.floor(Math.random() * data.engagement_comments.length)
    ];

    // Replace [topic] if present
    if (comment.includes('[topic]')) {
      const topics = ['tech', 'tutorials', 'learning', 'education', 'this topic'];
      const topic = topics[Math.floor(Math.random() * topics.length)];
      comment = comment.replace('[topic]', topic);
    }

    return comment;
  }

  /**
   * Get best comment type for the situation
   * Uses weighted random selection for natural distribution
   * @returns {string} Comment text
   */
  getSmartComment() {
    const rand = Math.random();

    // 50% - Regular positive comments
    if (rand < 0.5) {
      return this.getRandomComment({ category: 'positive' });
    }
    // 20% - Template-generated comments
    else if (rand < 0.7) {
      return this.generateFromTemplate();
    }
    // 10% - Specific praise
    else if (rand < 0.8) {
      return this.getRandomPraise();
    }
    // 10% - Engagement comments
    else if (rand < 0.9) {
      return this.getRandomEngagement();
    }
    // 5% - Question comments
    else if (rand < 0.95) {
      return this.getRandomQuestion();
    }
    // 5% - Short/emoji comments
    else {
      return this.getRandomComment({ category: 'neutral' });
    }
  }

  /**
   * Get multiple unique comments
   * @param {number} count - Number of comments to get
   * @returns {Array<string>} Array of unique comments
   */
  getMultipleComments(count = 5) {
    const comments = new Set();
    
    while (comments.size < count) {
      comments.add(this.getSmartComment());
    }

    return Array.from(comments);
  }
}

module.exports = new CommentHelper();
