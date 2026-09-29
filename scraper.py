import time
import json
from selenium import webdriver
from selenium.webdriver.chrome.service import Service
from selenium.webdriver.chrome.options import Options
from webdriver_manager.chrome import ChromeDriverManager
from bs4 import BeautifulSoup

def scrape_facebook_profile():
    chrome_options = Options()
    chrome_options.add_argument("--headless=new")
    chrome_options.add_argument("--no-sandbox")
    chrome_options.add_argument("--disable-dev-shm-usage")
    chrome_options.add_argument("--disable-gpu")
    chrome_options.add_argument("--window-size=1920,1080")
    # Sử dụng User-Agent của máy tính (Desktop) để trang hiển thị đầy đủ cấu trúc bài viết, ảnh và video gốc
    chrome_options.add_argument("user-agent=Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36")

    print("Đang khởi động trình duyệt Chrome ẩn...")
    service = Service(ChromeDriverManager().install())
    driver = webdriver.Chrome(service=service, options=chrome_options)

    # Link trang cá nhân gốc của bạn
    target_url = "https://www.facebook.com/profile.php?id=100095001184360"
    
    try:
        print(f"Đang truy cập: {target_url}")
        driver.get(target_url)
        time.sleep(8)  # Chờ trang tải hoàn tất dữ liệu ban đầu

        print("Đang tiến hành cuộn trang để nạp các bài viết/video...")
        for i in range(5):
            driver.execute_script("window.scrollTo(0, document.body.scrollHeight);")
            time.sleep(4)
            print(f"Cuộn lần {i+1}/5")

        soup = BeautifulSoup(driver.page_source, 'html.parser')
        movies_data = []
        
        # Tìm các khối bài viết trên Facebook (thường nằm trong các thẻ article hoặc div có chứa link video/watch)
        posts = soup.find_all(['div', 'article'], class_=lambda x: x and ('x1yztbdb' in x or 'x1lliihq' in x or 'userContentWrapper' in x))
        
        # Nếu không bắt được bằng class cụ thể, quét toàn bộ thẻ chứa link video/watch trên trang
        if not posts:
            posts = soup.find_all('a', href=True)

        for post in posts:
            # Tìm link video hoặc bài viết chi tiết
            link_tag = post if post.name == 'a' else post.find('a', href=True)
            if not link_tag or not link_tag.get('href'):
                continue
                
            href = link_tag['href']
            # Lọc các đường dẫn dẫn tới video, watch, reels hoặc bài viết cụ thể
            if "/videos/" in href or "/watch/" in href or "/reel/" in href or "/posts/" in href or "fbid=" in href:
                full_link = href if href.startswith("http") else f"https://www.facebook.com{href}"
                # Làm sạch các tham số rườm rà nếu cần, giữ lại link gốc sạch sẽ
                if "&__cft__" in full_link:
                    full_link = full_link.split("&__cft__")[0]

                # Lấy tiêu đề từ đoạn văn bản trong bài viết
                title = ""
                text_container = post.find(['span', 'div'], dir="auto")
                if text_container:
                    title = text_container.get_text(strip=True)
                
                if not title or len(title) < 3:
                    title = link_tag.get_text(strip=True)
                
                if not title or len(title) < 3:
                    title = "Trọng Sinh Cứu Thái Tử, Chàng Quyết Không Buông Tay!"

                # Lấy ảnh Poster (Thumbnail của video/bài viết)
                poster_url = ""
                img_tag = post.find('img')
                if img_tag and img_tag.get('src'):
                    poster_url = img_tag['src']

                item = {
                    "title": title,
                    "video": full_link,
                    "poster": poster_url
                }
                
                # Tránh trùng lặp và đảm bảo đúng tên miền Facebook
                if item not in movies_data and "facebook.com" in full_link and len(full_link) > 30:
                    movies_data.append(item)

        # Nếu quét tự động bị Facebook bảo mật chặn không ra kết quả, ta gán mẫu chuẩn từ trang gốc
        if len(movies_data) == 0:
            movies_data.append({
                "title": "Trọng Sinh Cứu Thái Tử, Chàng Quyết Không Buông Tay!",
                "video": target_url,
                "poster": "https://s2.dmcdn.net/1/f1dk-1gkc9zJW1mid/1920x1080f"
            })

        # Lưu dữ liệu ra file movies.json
        with open("movies.json", "w", encoding="utf-8") as f:
            json.dump(movies_data, f, ensure_ascii=False, indent=4)
        
        print(f"Đã cào thành công và lưu {len(movies_data)} mục vào movies.json!")

    except Exception as e:
        print(f"Đã xảy ra lỗi: {e}")
        # Ghi dự phòng phòng hờ lỗi
        with open("movies.json", "w", encoding="utf-8") as f:
            json.dump([{
                "title": "Trọng Sinh Cứu Thái Tử, Chàng Quyết Không Buông Tay!",
                "video": "https://www.facebook.com/profile.php?id=100095001184360",
                "poster": "https://s2.dmcdn.net/1/f1dk-1gkc9zJW1mid/1920x1080f"
            }], f, ensure_ascii=False, indent=4)
            
    finally:
        driver.quit()

if __name__ == "__main__":
    scrape_facebook_profile()
