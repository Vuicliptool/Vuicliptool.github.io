import json
import requests
from bs4 import BeautifulSoup

url = "https://fbwacth.com/"
headers = {
    "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"
}

try:
    response = requests.get(url, headers=headers, timeout=15)
    if response.status_code == 200:
        soup = BeautifulSoup(response.text, 'html.parser')
        movies = []
        
        # Quét các thẻ chứa phim trên trang gốc
        items = soup.select('.movie-card, article, .grid > div')
        
        for item in items:
            title_el = item.find(['h3', 'a'])
            title = title_el.get_text(strip=True) if title_el else "Phim mới cập nhật"
            
            poster = ""
            poster_div = item.select_one('.poster, [style*="background-image"]')
            if poster_div and poster_div.get('style'):
                style = poster_div['style']
                if 'url(' in style:
                    start = style.find('url(') + 4
                    end = style.find(')', start)
                    poster = style[start:end].strip('\'"')
            
            dur_el = item.select_one('.duration')
            duration = dur_el.get_text(strip=True) if dur_el else "Full"
            
            video = "https://geo.dailymotion.com/player.html?video=xb1j9wq"
            
            if poster:
                movies.append({
                    "title": title,
                    "duration": duration,
                    "poster": poster,
                    "video": video
                })
        
        if movies:
            with open('movies.json', 'w', encoding='utf-8') as f:
                json.dump(movies, f, ensure_ascii=False, indent=4)
            print(f"Đã cập nhật thành công {len(movies)} phim!")
        else:
            print("Không tìm thấy thẻ phim nào.")
    else:
        print(f"Lỗi kết nối trang gốc: {response.status_code}")
except Exception as e:
    print(f"Lỗi: {e}")
