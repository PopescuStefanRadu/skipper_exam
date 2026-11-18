package auth

import (
	"context"
	"errors"
	"fmt"
	"sync"

	"github.com/coreos/go-oidc/v3/oidc"
	"golang.org/x/oauth2"
)

// Provider is the sign-in service, reached through OpenID Connect: an
// authorization code flow with PKCE and a nonce. Its discovery document is read at
// the first sign-in, so the app starts even while the service is down.
type Provider struct {
	IssuerURL    string
	ClientID     string
	ClientSecret string
	// RedirectURL is the app's /auth/callback.
	RedirectURL string

	mu       sync.Mutex
	config   *oauth2.Config
	verifier *oidc.IDTokenVerifier
}

// Claims is who the sign-in service says signed in.
type Claims struct {
	Subject string
	Email   string
}

func (p *Provider) load(ctx context.Context) (*oauth2.Config, *oidc.IDTokenVerifier, error) {
	p.mu.Lock()
	defer p.mu.Unlock()
	if p.config == nil {
		provider, err := oidc.NewProvider(ctx, p.IssuerURL)
		if err != nil {
			return nil, nil, fmt.Errorf("sign-in service discovery: %w", err)
		}
		p.config = &oauth2.Config{
			ClientID:     p.ClientID,
			ClientSecret: p.ClientSecret,
			RedirectURL:  p.RedirectURL,
			Endpoint:     provider.Endpoint(),
			Scopes:       []string{oidc.ScopeOpenID, "email", "profile"},
		}
		p.verifier = provider.Verifier(&oidc.Config{ClientID: p.ClientID})
	}
	return p.config, p.verifier, nil
}

// AuthURL is the sign-in service's page that starts a sign-in.
func (p *Provider) AuthURL(ctx context.Context, state, nonce, verifier string) (string, error) {
	config, _, err := p.load(ctx)
	if err != nil {
		return "", err
	}
	return config.AuthCodeURL(state, oidc.Nonce(nonce), oauth2.S256ChallengeOption(verifier)), nil
}

// Exchange trades the code the sign-in service returned for the user's identity,
// checking the ID token's signature, issuer, audience, expiry and nonce.
func (p *Provider) Exchange(ctx context.Context, code, verifier, nonce string) (Claims, error) {
	config, idVerifier, err := p.load(ctx)
	if err != nil {
		return Claims{}, err
	}
	token, err := config.Exchange(ctx, code, oauth2.VerifierOption(verifier))
	if err != nil {
		return Claims{}, fmt.Errorf("code exchange: %w", err)
	}
	raw, ok := token.Extra("id_token").(string)
	if !ok {
		return Claims{}, errors.New("no id_token in the token response")
	}
	idToken, err := idVerifier.Verify(ctx, raw)
	if err != nil {
		return Claims{}, fmt.Errorf("id token: %w", err)
	}
	if idToken.Nonce != nonce {
		return Claims{}, errors.New("id token: wrong nonce")
	}
	var claims struct {
		Email string `json:"email"`
	}
	if err := idToken.Claims(&claims); err != nil {
		return Claims{}, err
	}
	if claims.Email == "" {
		return Claims{}, errors.New("id token: no email")
	}
	return Claims{Subject: idToken.Subject, Email: claims.Email}, nil
}
