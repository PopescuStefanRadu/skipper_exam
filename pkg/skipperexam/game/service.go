package game

import (
	"context"
	"database/sql"
)

type Service struct {
	DB *sql.DB
}

func (s *Service) NewGame(ctx context.Context, userId *string) (Game, error) {

}
