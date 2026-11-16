package main

import (
	"context"
	"errors"
	"fmt"
	"log/slog"
	"net/http"
	"os"
	"os/signal"
	"syscall"
	"time"

	"github.com/jackc/pgx/v5/pgxpool"

	"github.com/PopescuStefanRadu/skipper_exam/pkg/skipperexam/server"
)

func main() {
	// The container image has no shell or curl, so the container healthcheck calls the binary itself.
	if len(os.Args) > 1 && os.Args[1] == "healthcheck" {
		if err := healthcheck(); err != nil {
			os.Exit(1)
		}
		return
	}
	if err := run(); err != nil {
		slog.Error("server stopped", "err", err)
		os.Exit(1)
	}
}

func run() error {
	ctx, stop := signal.NotifyContext(context.Background(), os.Interrupt, syscall.SIGTERM)
	defer stop()

	dbURL := os.Getenv("DATABASE_URL")
	if dbURL == "" {
		return errors.New("DATABASE_URL is required")
	}
	pool, err := pgxpool.New(ctx, dbURL)
	if err != nil {
		return err
	}
	defer pool.Close()

	kratos, err := server.NewKratos(os.Getenv("KRATOS_PUBLIC_URL"))
	if err != nil || os.Getenv("KRATOS_PUBLIC_URL") == "" {
		return errors.New("KRATOS_PUBLIC_URL is required")
	}
	cfg := server.Config{DB: pool, Sessions: kratos, AccountsProxy: kratos.Proxy()}
	if dir := os.Getenv("WEB_DIR"); dir != "" {
		cfg.Web = os.DirFS(dir)
	}

	addr := os.Getenv("LISTEN_ADDR")
	if addr == "" {
		addr = ":8080"
	}
	srv := &http.Server{Addr: addr, Handler: server.New(cfg), ReadHeaderTimeout: 10 * time.Second}

	errc := make(chan error, 1)
	go func() { errc <- srv.ListenAndServe() }()
	slog.Info("listening", "addr", addr)

	select {
	case err := <-errc:
		return err
	case <-ctx.Done():
	}
	shutdownCtx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
	defer cancel()
	return srv.Shutdown(shutdownCtx)
}

func healthcheck() error {
	client := http.Client{Timeout: 2 * time.Second}
	res, err := client.Get("http://localhost:8080/api/health")
	if err != nil {
		return err
	}
	defer res.Body.Close()
	if res.StatusCode != http.StatusOK {
		return fmt.Errorf("health status %d", res.StatusCode)
	}
	return nil
}
