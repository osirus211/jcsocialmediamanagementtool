// Mock nanoid for Jest tests
module.exports = {
  nanoid: () => 'test-nanoid-' + Math.random().toString(36).substr(2, 9)
};