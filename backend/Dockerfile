FROM golang:1.22-alpine AS build
WORKDIR /src
RUN apk add --no-cache git ca-certificates
COPY go.mod go.sum ./
RUN go mod download
COPY . .
RUN CGO_ENABLED=0 GOOS=linux go build -o /out/webcall .

FROM alpine:3.20
WORKDIR /app
RUN apk add --no-cache ca-certificates
COPY --from=build /out/webcall /app/webcall
RUN mkdir -p /app/uploads
ENV PORT=8080 UPLOAD_DIR=/app/uploads
EXPOSE 8080
CMD ["/app/webcall"]
