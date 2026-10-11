# 本地开发环境

当前本地开发采用 macOS + OrbStack。Java、Node.js 和 Python Agent 的运行时都放在项目的 `.runtime/` 或容器中，不依赖全局 Homebrew 包。

## 已准备好的环境

- Java 21（Temurin）和 Node.js 22：`.runtime/`
- PostgreSQL 17：OrbStack 容器 `unispeaking-postgres`，端口 `5432`
- Spring Boot 后端：`http://127.0.0.1:8080`
- Web 前端：`http://127.0.0.1:5173`
- Python 3.11 Agent：`http://127.0.0.1:8000`
- 管理端和移动端的 npm 依赖已经安装；移动端启动还需要 Xcode 或 Android Studio 的模拟器。

## 启动服务

在项目根目录执行：

```sh
# 每个终端会话先加载项目运行时
. .runtime/activate.sh

# PostgreSQL（已有容器时只需 docker start）
docker start unispeaking-postgres 2>/dev/null || docker run --name unispeaking-postgres \
  -e POSTGRES_DB=unispeaking \
  -e POSTGRES_USER=unispeaking \
  -e POSTGRES_PASSWORD=unispeaking-local-password \
  -p 5432:5432 \
  -v deploy_unispeaking_dev_postgres_data:/var/lib/postgresql/data \
  -d docker.m.daocloud.io/library/postgres:17-alpine

# Python Agent
docker compose -f agent-service/docker-compose.yml up --build -d
```

后端使用本地环境文件和 Maven 镜像启动：

```sh
cd backend/unispeaking-server
set -a; . ../../deploy/env/.env; set +a
export DATABASE_URL=jdbc:postgresql://127.0.0.1:5432/unispeaking
export DATABASE_USERNAME=unispeaking
export DATABASE_PASSWORD=unispeaking-local-password
export AUTH_COOKIE_SECURE=false
export UNISPEAKING_ADMIN_SECURE_COOKIE=false
export AUTH_CAPTCHA_PROVIDER=development
export AUTH_CAPTCHA_DEVELOPMENT_TOKEN=local-human-verified
export WEB_ALLOWED_ORIGIN_PATTERNS='http://localhost:*,http://127.0.0.1:*'
export OCR_ENABLED=false
export MANAGEMENT_HEALTH_MAIL_ENABLED=false
. ../../.runtime/activate.sh
MAVEN_USER_HOME=../../.m2 MAVEN_REPO_URL=https://maven.aliyun.com/repository/public \
  ./mvnw -s docker/maven/settings.xml spring-boot:run
```

Web 前端在另一个终端启动：

```sh
cd frontend/web
. ../../.runtime/activate.sh
npm run dev -- --host 127.0.0.1 --port 5173
```

## Agent 接口快速检查

```sh
curl http://127.0.0.1:8000/health
curl http://127.0.0.1:8080/actuator/health
```

Agent 的请求和响应模型在 `agent-service/app/models.py`，目前策略是确定性的个性化基线：根据学习目标选择教练人格，根据 CEFR 等级调节难度，并从兴趣和最近反馈生成下一轮追问。后续接入真实模型时，保持 `/v1/coach/turn` 和 `/v1/coach/plan` 的 JSON 契约即可替换策略实现。

