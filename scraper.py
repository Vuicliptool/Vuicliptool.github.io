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
        
        items = soup.select('.movie-card, article, .grid > div')
        
        for item in items:
            title_el = item.find(['h3', 'a'])
            title = title_el.get_text(strip=True) if title_el else "Phim mới cập nhật"
            
            link_el = item.find('a')
            detail_url = ""
            if link_el and link_el.has_attr('href'):
                href = link_el['href']
                detail_url = href if href.startswith('http') else "https://fbwacth.com" + href
            
            # Lấy ảnh poster
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
            
            # 👉 Tự động đi sâu vào trang chi tiết để lấy link phát video gốc (bỏ qua trang quảng cáo)
            video_embed = "https://geo.dailymotion.com/player.html?video=xb1j9wq" # Link mặc định phòng hờ
            if detail_url:
                try:
                    detail_res = requests.get(detail_url, headers=headers, timeout=10)
                    if detail_res.status_code == 200:
                        detail_soup = BeautifulSoup(detail_res.text, 'html.parser')
                        iframe = detail_soup.find('iframe')
                        if iframe and iframe.has_attr('src'):
                            video_embed = iframe['src']
                except:
                    pass
            
            if poster:
                movies.append({
                    "title": title,
                    "duration": duration,
                    "poster": poster,
                    "video": video_embed
                })
        
        if movies:
            with open('movies.json', 'w', encoding='utf-8') as f:
                json.dump(movies, f, ensure_ascii=False, indent=4)
            print(f"Đã cập nhật thành công {len(movies)} phim sạch không quảng cáo!")
        else:
            print("Không tìm thấy thẻ phim nào.")
    else:
        print(f"Lỗi kết nối trang gốc: {response.status_code}")
except Exception as e:
    print(f"Lỗi: {e}")
