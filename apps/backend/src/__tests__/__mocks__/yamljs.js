// Mock for yamljs module
module.exports = {
  load: jest.fn(() => ({})),
  parse: jest.fn(() => ({})),
  stringify: jest.fn(() => ''),
};