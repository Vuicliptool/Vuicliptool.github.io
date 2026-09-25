import json
import requests

# API chính thức của Dailymotion để lấy danh sách video của user @MovieReel
api_url = "https://api.dailymotion.com/user/MovieReel/videos?limit=50&fields=id,title,thumbnail_url,duration"

try:
    response = requests.get(api_url, timeout=15)
    if response.status_code == 200:
        data = response.json()
        movies = []
        
        items = data.get('list', [])
        for item in items:
            title = item.get('title', 'Phim mới cập nhật')
            vid_id = item.get('id', '')
            poster = item.get('thumbnail_url', '')
            
            # Xử lý thời lượng video từ giây sang định dạng phút:giây hoặc Full
            duration_sec = item.get('duration', 0)
            if duration_sec:
                mins = duration_sec // 60
                secs = duration_sec % 60
                duration = f"{mins}:{secs:02d}"
            else:
                duration = "Full"
            
            # Link iframe để nhúng vào web không quảng cáo
            video_embed = f"https://geo.dailymotion.com/player.html?video={vid_id}"
            
            # Link tải / xem trực tiếp trên Dailymotion (để Cốc Cốc bắt link)
            download_url = f"https://www.dailymotion.com/video/{vid_id}"
            
            if vid_id and poster:
                movies.append({
                    "title": title,
                    "duration": duration,
                    "poster": poster,
                    "video": video_embed,
                    "download": download_url
                })
        
        if movies:
            with open('movies.json', 'w', encoding='utf-8') as f:
                json.dump(movies, f, ensure_ascii=False, indent=4)
            print(f"Đã cập nhật thành công {len(movies)} phim từ kênh MovieReel!")
        else:
            print("Không tìm thấy video nào trong kênh.")
    else:
        print(f"Lỗi kết nối API Dailymotion: {response.status_code}")
except Exception as e:
    print(f"Lỗi: {e}")
