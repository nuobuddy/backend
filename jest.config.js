module.exports = {
  preset: 'ts-jest',
  testEnvironment: 'node',
  
  moduleNameMapper: {
    '^@/(.*)$': '<rootDir>/src/$1',
  },
  
  moduleDirectories: ['node_modules', 'src'],
  
  moduleFileExtensions: ['ts', 'js', 'json', 'node'],
  
  testMatch: ['**/__tests__/**/*.ts', '**/?(*.)+(spec|test).ts'],
  
  transform: {
    '^.+\\.ts$': 'ts-jest',
  },
};