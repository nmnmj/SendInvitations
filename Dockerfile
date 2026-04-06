# Use a Node.js 20+ base with Chromium pre-installed to satisfy Vite 8 requirements
FROM ghcr.io/puppeteer/puppeteer:23.11.1

# Set default port
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

# Set production environment for runtime
ENV NODE_ENV=production

# Start the application using 'npm start' (node whatsapp_server.js)
CMD ["npm", "run", "start"]
