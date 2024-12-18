package game

type Game struct {
	Id        string
	UserId    *string
	Questions []Question
}

type Question struct {
	Text          string
	Image         []byte
	Answers       []Answer
	CorrectAnswer string
}

type Answer struct {
	Identifier string
	Text       string
}
