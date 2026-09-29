FROM golang:1.22-alpine AS builder

WORKDIR /src

COPY go.mod go.sum ./
RUN go mod download

COPY . .
RUN CGO_ENABLED=0 GOOS=linux GOARCH=amd64 go build -trimpath -ldflags='-s -w' -o /out/webcall ./

FROM alpine:3.22

RUN apk add --no-cache ca-certificates wget \
    && adduser -D -H -u 10001 appuser \
    && mkdir -p /app/uploads \
    && chown -R appuser:appuser /app

WORKDIR /app
COPY --from=builder /out/webcall /app/webcall

USER appuser

ENV PORT=8080
ENV UPLOAD_DIR=/app/uploads
EXPOSE 8080

HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
  CMD wget -qO- http://127.0.0.1:8080/api/health >/dev/null || exit 1

ENTRYPOINT ["/app/webcall"]
