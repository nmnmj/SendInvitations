# Use a standard, slim Node.js image to save massive amounts of RAM and disk space
# since Baileys (our new engine) doesn't need a heavy browser/Chrome.
FROM node:20-slim

# Set working directory
WORKDIR /app

# Install basic system dependencies required by Node
RUN apt-get update && apt-get install -y \
    ca-certificates \
    && rm -rf /var/lib/apt/lists/*

# Copy package files and install dependencies
COPY package*.json ./
RUN npm install

# Copy all application source code
COPY . .

# Build the Vite frontend into the 'dist' folder
RUN npm run build

# Default Render port
ENV PORT=10000
EXPOSE 10000

# Set production environment
ENV NODE_ENV=production

# Start the application!
CMD ["npm", "start"]
