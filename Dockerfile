# Use a Node.js base with Chromium pre-installed to simplify Puppeteer setup on Render
FROM ghcr.io/puppeteer/puppeteer:21.0.0

# Set production environment and default port
ENV NODE_ENV=production
ENV PORT=10000

# Switch to root to manage file permissions for build
USER root
WORKDIR /app

# Copy package files and install dependencies
COPY package*.json ./
RUN npm install

# Copy the rest of the application files
COPY . .

# Build the Vite frontend into the 'dist' folder
# (whatsapp_server.js is configured to serve this folder automatically)
RUN npm run build

# Expose the internal port for Render to connect
EXPOSE 10000

# Start the application using 'npm start' (node whatsapp_server.js)
CMD ["npm", "run", "start"]
