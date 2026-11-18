package main

import (
	"context"
	"errors"
	"flag"
	"fmt"
	"log/slog"
	"net/http"
	"os"
	"os/signal"
	"strings"
	"syscall"
	"time"

	"github.com/jackc/pgx/v5/pgxpool"

	"github.com/PopescuStefanRadu/skipper_exam/pkg/skipperexam/account"
	"github.com/PopescuStefanRadu/skipper_exam/pkg/skipperexam/auth"
	"github.com/PopescuStefanRadu/skipper_exam/pkg/skipperexam/content"
	"github.com/PopescuStefanRadu/skipper_exam/pkg/skipperexam/db"
	"github.com/PopescuStefanRadu/skipper_exam/pkg/skipperexam/events"
	"github.com/PopescuStefanRadu/skipper_exam/pkg/skipperexam/profile"
	"github.com/PopescuStefanRadu/skipper_exam/pkg/skipperexam/review"
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
	if len(os.Args) > 1 && os.Args[1] == "grant-role" {
		if err := grantRole(os.Args[2:]); err != nil {
			fmt.Fprintln(os.Stderr, err)
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

	if err := db.Migrate(ctx, pool); err != nil {
		return fmt.Errorf("migrate: %w", err)
	}

	contentDir := os.Getenv("CONTENT_DIR")
	if contentDir == "" {
		contentDir = "content"
	}
	c, err := content.Load(contentDir)
	if err != nil {
		return fmt.Errorf("load content: %w", err)
	}

	pkg, err := c.Package()
	if err != nil {
		return fmt.Errorf("content package: %w", err)
	}

	lib := &server.Library{Content: c, Dir: contentDir, Texts: map[string]*content.SourceText{}}
	for _, s := range c.Sources {
		if s.Kind == content.KindBibliography {
			if lib.Texts[s.ID], err = content.LoadText(contentDir, s.ID); err != nil {
				return fmt.Errorf("load text of %s: %w", s.ID, err)
			}
		}
	}
	reviews := &review.Store{Pool: pool}

	appURL := strings.TrimSuffix(os.Getenv("APP_URL"), "/")
	if appURL == "" {
		return errors.New("APP_URL is required (the app's public address)")
	}
	for _, name := range []string{"OIDC_ISSUER_URL", "OIDC_CLIENT_ID", "OIDC_CLIENT_SECRET"} {
		if os.Getenv(name) == "" {
			return fmt.Errorf("%s is required (the sign-in service's client)", name)
		}
	}
	authStore := &auth.Store{Pool: pool}
	signIn := &server.Auth{
		Store: authStore,
		Service: &auth.Provider{
			IssuerURL:    os.Getenv("OIDC_ISSUER_URL"),
			ClientID:     os.Getenv("OIDC_CLIENT_ID"),
			ClientSecret: os.Getenv("OIDC_CLIENT_SECRET"),
			RedirectURL:  appURL + "/auth/callback",
		},
		SecureCookies: strings.HasPrefix(appURL, "https://"),
	}
	cfg := server.Config{
		DB:        pool,
		Sessions:  signIn,
		Auth:      signIn,
		Profiles:  &profile.Store{Pool: pool},
		Events:    &events.Store{Pool: pool},
		ExamTypes: c.ExamTypes,
		Content:   pkg,
		Library:   lib,
		Reviews:   reviews,
		Accounts:  &account.Store{Pool: pool},
	}
	// Deleting an account also deletes its user in the sign-in service, if the user
	// exists only for this app. Without these settings (the test stack) it doesn't.
	if u := os.Getenv("AUTHENTIK_URL"); u != "" {
		token, group := os.Getenv("AUTHENTIK_API_TOKEN"), os.Getenv("AUTHENTIK_APP_GROUP")
		if token == "" || group == "" {
			return errors.New("AUTHENTIK_URL needs AUTHENTIK_API_TOKEN and AUTHENTIK_APP_GROUP")
		}
		ak, err := auth.NewAuthentik(u, token, group)
		if err != nil {
			return fmt.Errorf("AUTHENTIK_URL: %w", err)
		}
		cfg.Identities = ak
	}
	if dir := os.Getenv("WEB_DIR"); dir != "" {
		cfg.Web = os.DirFS(dir)
	}
	// The Android app's web view runs on its own origin (Capacitor's default).
	cfg.AppOrigins = []string{"https://localhost"}
	if origins := os.Getenv("APP_ORIGINS"); origins != "" {
		cfg.AppOrigins = strings.Split(origins, ",")
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

// grantRole gives the account with the given email a role, e.g. reviewer. It reads
// DATABASE_URL from the environment.
func grantRole(args []string) error {
	fs := flag.NewFlagSet("grant-role", flag.ExitOnError)
	email := fs.String("email", "", "the account's email")
	role := fs.String("role", "", "the role, e.g. reviewer")
	_ = fs.Parse(args)
	if *email == "" || *role != server.RoleReviewer {
		return fmt.Errorf("usage: server grant-role -email EMAIL -role %s", server.RoleReviewer)
	}
	ctx := context.Background()
	pool, err := pgxpool.New(ctx, os.Getenv("DATABASE_URL"))
	if err != nil {
		return err
	}
	defer pool.Close()
	ids, err := (&auth.Store{Pool: pool}).ByEmail(ctx, *email)
	if err != nil {
		return err
	}
	if len(ids) != 1 {
		return fmt.Errorf("no single account with email %s (it exists after its first sign-in)", *email)
	}
	if err := (&review.Store{Pool: pool}).Grant(ctx, ids[0].ID, *role); err != nil {
		return err
	}
	fmt.Printf("%s is now a %s\n", *email, *role)
	return nil
}
