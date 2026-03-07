# Development Dockerfile for Backend
FROM node:18-alpine

# Set working directory
WORKDIR /app

# Install dependencies for native modules
RUN apk add --no-cache python3 make g++

# Copy package files
COPY package*.json ./

# Install dependencies
RUN npm install

# Rebuild native modules for the container architecture
RUN npm rebuild bcrypt --build-from-source

# Copy source code
COPY . .

# Expose port
EXPOSE 5000

# Start development server with hot reload
CMD ["npm", "run", "dev"]
