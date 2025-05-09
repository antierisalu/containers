package main

import (
	"context"
	"fmt"
	"log"
	"net/http"
	"os"
	"strings"
	"time"

	"golang.org/x/oauth2/google"
	"google.golang.org/api/option"
	"google.golang.org/api/youtube/v3"
)

var (
	VideoURL string
	Port     = "8065"
)

func main() {
	http.HandleFunc("/", func(w http.ResponseWriter, r *http.Request) {
		openVideoInBrowser()
		fmt.Fprintf(w, `<html><body><script>window.location.replace("%s");</script></body></html>`, VideoURL)
	})
	log.Fatal(http.ListenAndServe(":"+Port, nil))
}

func openVideoInBrowser() {
	ctx := context.Background()

	// Read the client secret file
	secretFile, err := os.ReadFile("../alpine-realm-381711-c882a05f7e41.json")
	if err != nil {
		log.Fatalf("Unable to read client secret file: %v", err)
	}

	// Parse client secret file to config
	config, err := google.JWTConfigFromJSON(secretFile, youtube.YoutubeReadonlyScope)
	if err != nil {
		log.Fatalf("Unable to parse client secret file to config: %v", err)
	}

	// Create HTTP client
	httpClient := config.Client(ctx)

	// Create YouTube service client
	youtubeService, err := youtube.NewService(ctx, option.WithHTTPClient(httpClient))
	if err != nil {
		log.Fatalf("Error creating YouTube client: %v", err)
	}

	// Fetch playlists from YouTube channel
	playlistsCall := youtubeService.Playlists.List([]string{"snippet"}).ChannelId("UCFKE7WVJfvaHW5q283SxchA").MaxResults(50)
	playlistsResponse, err := playlistsCall.Do()
	if err != nil {
		log.Fatalf("Error fetching playlists: %v", err)
	}

	var selectedPlaylist *youtube.Playlist

	// Find playlist for the current month
	for _, playlist := range playlistsResponse.Items {
		if month := time.Now().Month().String(); strings.Contains(playlist.Snippet.Title, month) {
			selectedPlaylist = playlist
			break
		} else {
			// get the last playlist
			selectedPlaylist = playlistsResponse.Items[0]
		}
		fmt.Println(selectedPlaylist)
	}

	// Check if no playlist found for the current month
	if selectedPlaylist == nil {
		log.Fatalf("No playlist found for the current month")
	}

	// Fetch playlist items
	playlistItemsCall := youtubeService.PlaylistItems.List([]string{"snippet"}).PlaylistId(selectedPlaylist.Id).MaxResults(50)
	playlistItemsResponse, err := playlistItemsCall.Do()
	if err != nil {
		log.Fatalf("Error fetching playlist items: %v", err)
	}

	// Calculate index of the video for the current day
	videoIndex := (time.Now().Day() - 1)
	videoId := playlistItemsResponse.Items[videoIndex].Snippet.ResourceId.VideoId
	VideoURL = fmt.Sprintf("https://www.youtube.com/embed/%s"+"?autoplay=1", videoId)
}
