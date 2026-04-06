FROM node:20-alpine

# Install wget for healthcheck
RUN apk add --no-cache wget

WORKDIR /app

# Copy ONLY package files first
COPY src/backend/package*.json ./backend/

# Install dependencies
WORKDIR /app/backend
RUN npm ci

# Copy the rest of the source code (the .dockerignore prevents node_modules from sneaking in here)
WORKDIR /app
COPY src ./

# Set the working directory and start command
WORKDIR /app/backend
CMD ["npm", "start"]