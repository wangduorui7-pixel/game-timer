# 五游活动倒计时台 —— 生产镜像
# Zeabur / 任意支持 Docker 的平台通用
FROM node:22-bookworm-slim

# better-sqlite3 是原生模块，node-gyp 需要编译工具链
RUN apt-get update && apt-get install -y --no-install-recommends \
    python3 make g++ \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

# 先拷贝依赖清单，利用 Docker 层缓存
COPY package*.json ./
# NODE_ENV=production 会让 npm 默认裁剪 devDependencies，
# 而 vite / tsc / tsx 都在 devDependencies，必须显式 --include=dev
RUN npm install --include=dev

# 拷贝源码并构建
COPY . .
RUN npm run build

ENV NODE_ENV=production
ENV PORT=3001
EXPOSE 3001

# tsx 已在 install --include=dev 时装好，运行时直接执行 server
CMD ["npm", "start"]
