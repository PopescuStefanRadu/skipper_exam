FROM node:24-alpine AS web
RUN corepack enable
WORKDIR /web
COPY web/package.json web/pnpm-lock.yaml web/pnpm-workspace.yaml ./
RUN pnpm install --frozen-lockfile
COPY web/ ./
RUN pnpm build

FROM golang:1.24-alpine AS backend
WORKDIR /src
COPY go.mod go.sum ./
RUN go mod download
COPY cli cli
COPY pkg pkg
RUN CGO_ENABLED=0 go build -o /server ./cli/server

FROM gcr.io/distroless/static-debian12
COPY --from=backend /server /server
COPY --from=web /web/dist /web
ENV WEB_DIR=/web LISTEN_ADDR=:8080
EXPOSE 8080
ENTRYPOINT ["/server"]
