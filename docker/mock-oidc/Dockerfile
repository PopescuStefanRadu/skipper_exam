# The test stack's fake sign-in service (cli/mock-oidc). Built from the repository root.
FROM golang:1.24-alpine AS build
WORKDIR /src
COPY go.mod go.sum ./
RUN go mod download
COPY cli/mock-oidc cli/mock-oidc
RUN CGO_ENABLED=0 go build -o /mock-oidc ./cli/mock-oidc

FROM gcr.io/distroless/static-debian12
COPY --from=build /mock-oidc /mock-oidc
ENTRYPOINT ["/mock-oidc"]
