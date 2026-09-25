import json
import requests

# Danh sách các kênh Dailymotion nguồn phim mà bạn muốn tổng hợp
# Bạn có thể thêm tên user khác vào danh sách này (ví dụ: ["MovieReel", "ShortDrama1018", "kenhkhac"])
channels = ["ducanawm829", "MovieReel"]

all_movies = []
seen_ids = {}

for channel in channels:
    api_url = f"https://api.dailymotion.com/user/{channel}/videos?limit=50&fields=id,title,thumbnail_url,duration"
    try:
        response = requests.get(api_url, timeout=15)
        if response.status_code == 200:
            data = response.json()
            items = data.get('list', [])
            
            for item in items:
                vid_id = item.get('id', '')
                # Tránh lấy trùng video nếu các kênh đăng chung nội dung
                if vid_id and vid_id not in seen_ids:
                    seen_ids[vid_id] = True
                    
                    title = item.get('title', 'Phim mới cập nhật')
                    poster = item.get('thumbnail_url', '')
                    
                    # Xử lý thời lượng video
                    duration_sec = item.get('duration', 0)
                    if duration_sec:
                        mins = duration_sec // 60
                        secs = duration_sec % 60
                        duration = f"{mins}:{secs:02d}"
                    else:
                        duration = "Full"
                    
                    video_embed = f"https://geo.dailymotion.com/player.html?video={vid_id}"
                    download_url = f"https://www.dailymotion.com/video/{vid_id}"
                    
                    if poster:
                        all_movies.append({
                            "title": title,
                            "duration": duration,
                            "poster": poster,
                            "video": video_embed,
                            "download": download_url
                        })
    except Exception as e:
        print(f"Lỗi khi quét kênh {channel}: {e}")

# Lưu lại toàn bộ danh sách phim tổng hợp từ các kênh
if all_movies:
    with open('movies.json', 'w', encoding='utf-8') as f:
        json.dump(all_movies, f, ensure_ascii=False, indent=4)
    print(f"Đã tổng hợp thành công tổng cộng {len(all_movies)} phim từ các kênh!")
else:
    print("Không tìm thấy phim nào.")
