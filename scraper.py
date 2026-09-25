import json
import re
import requests
from bs4 import BeautifulSoup

url = "https://fbwacth.com/"
headers = {
    "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"
}

session = requests.Session()
session.headers.update(headers)

try:
    response = session.get(url, timeout=15)
    if response.status_code == 200:
        soup = BeautifulSoup(response.text, 'html.parser')
        movies = []
        
        # Quét tất cả các khung chứa phim trên trang
        items = soup.select('.movie-card, article, .grid > div, div[class*="item"]')
        
        for item in items:
            # 1. Lấy Tiêu đề phim chuẩn xác nhất
            title = ""
            title_el = item.find(['h3', 'h4', 'span', 'a'], class_=lambda x: x and ('title' in x or 'name' in x))
            if title_el:
                title = title_el.get_text(strip=True)
            else:
                # Fallback tìm các thẻ text bên trong
                for el in item.find_all(['h3', 'h4', 'p', 'a']):
                    txt = el.get_text(strip=True)
                    if txt and len(txt) > 3 and not txt.startswith("HOT") and ":" not in txt:
                        title = txt
                        break
            if not title:
                title = "Phim mới cập nhật"

            # 2. Lấy link chi tiết
            link_el = item.find('a')
            detail_url = ""
            if link_el and link_el.has_attr('href'):
                href = link_el['href']
                detail_url = href if href.startswith('http') else "https://fbwacth.com" + href
            
            # 3. Lấy ảnh Poster (hỗ trợ cả thẻ img lẫn background-image)
            poster = ""
            img_el = item.find('img')
            if img_el:
                poster = img_el.get('src') or img_el.get('data-src') or ""
            
            if not poster:
                poster_div = item.select_one('.poster, [style*="background-image"]')
                if poster_div and poster_div.get('style'):
                    style = poster_div['style']
                    if 'url(' in style:
                        start = style.find('url(') + 4
                        end = style.find(')', start)
                        poster = style[start:end].strip('\'"')
            
            if poster and not poster.startswith('http'):
                poster = "https://fbwacth.com" + poster

            # 4. Lấy thời lượng phim
            dur_el = item.select_one('.duration, span[class*="time"]')
            duration = dur_el.get_text(strip=True) if dur_el else "Full"
            
            video_embed = "https://geo.dailymotion.com/player.html?video=xb1j9wq"
            download_url = video_embed
            
            if detail_url:
                try:
                    detail_res = session.get(detail_url, timeout=10)
                    if detail_res.status_code == 200:
                        detail_soup = BeautifulSoup(detail_res.text, 'html.parser')
                        
                        iframes = detail_soup.find_all('iframe')
                        for iframe in iframes:
                            src = iframe.get('src', '')
                            if 'dailymotion.com' in src or 'player' in src:
                                video_embed = src
                                break
                        
                        dm_match = re.search(r'video=([a-zA-Z0-9]+)', video_embed)
                        if dm_match:
                            vid_id = dm_match.group(1)
                            download_url = f"https://www.dailymotion.com/video/{vid_id}"
                        else:
                            download_url = video_embed
                except:
                    pass
            
            # Chỉ thêm vào danh sách nếu quét được poster hợp lệ
            if poster:
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
            print(f"Đã cập nhật thành công {len(movies)} phim!")
        else:
            print("Không tìm thấy phim nào do cấu trúc thay đổi.")
    else:
        print(f"Lỗi kết nối: {response.status_code}")
except Exception as e:
    print(f"Lỗi: {e}")
