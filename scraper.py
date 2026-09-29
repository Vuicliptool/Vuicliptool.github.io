import time
import json
from selenium import webdriver
from selenium.webdriver.chrome.service import Service
from selenium.webdriver.chrome.options import Options
from webdriver_manager.chrome import ChromeDriverManager
from bs4 import BeautifulSoup

def scrape_facebook_reels():
    # Cấu hình Chrome chạy ẩn (headless) trên GitHub Actions
    chrome_options = Options()
    chrome_options.add_argument("--headless=new")  # Chế độ ẩn giao diện mới nhất của Chrome
    chrome_options.add_argument("--no-sandbox")
    chrome_options.add_argument("--disable-dev-shm-usage")
    chrome_options.add_argument("--disable-gpu")
    chrome_options.add_argument("--window-size=1920,1080")
    
    # Giả lập User-Agent trình duyệt điện thoại để trang m.facebook.com trả về giao diện di động dễ cào
    chrome_options.add_argument("user-agent=Mozilla/5.0 (iPhone; CPU iPhone OS 16_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/16.0 Mobile/15E148 Safari/604.1")

    print("Đang khởi động trình duyệt Chrome ẩn...")
    service = Service(ChromeDriverManager().install())
    driver = webdriver.Chrome(service=service, options=chrome_options)

    # Link trang Reels Facebook mục tiêu
    target_url = "https://m.facebook.com/profile.php?id=100095001184360&name=xhp_nt__fblite__profile__tab_bar&profile_tab_item_selected=reels"
    
    try:
        print(f"Đang truy cập: {target_url}")
        driver.get(target_url)
        time.sleep(6)  # Chờ trang tải hoàn tất

        print("Đang tiến hành cuộn trang để nạp thêm Reels...")
        scrolled_times = 0
        max_scrolls = 8  # Số lần cuộn trang (có thể tăng giảm tùy ý)
        
        while scrolled_times < max_scrolls:
            driver.execute_script("window.scrollTo(0, document.body.scrollHeight);")
            time.sleep(4)  # Chờ dữ liệu từ mạng tải về
            scrolled_times += 1
            print(f"Đã cuộn lần thứ {scrolled_times}/{max_scrolls}")

        # Lấy mã nguồn sau khi cuộn
        page_source = driver.page_source
        soup = BeautifulSoup(page_source, 'html.parser')

        reels_data = []
        
        # Quét các đường dẫn thẻ a trong trang
        links = soup.find_all('a', href=True)
        
        for link in links:
            href = link['href']
            # Lọc các link chứa video hoặc reel của Facebook
            if "/reel/" in href or "/watch/" in href or "video" in href:
                full_link = href if href.startswith("https") else f"https://m.facebook.com{href}"
                
                # Lấy nội dung tiêu đề video nếu có
                title = link.get_text(strip=True)
                if not title or len(title) < 3:
                    title = "Video Reels Facebook"

                item = {
                    "title": title,
                    "video": full_link,
                    "poster": "" # Có thể cập nhật nếu tìm thấy thẻ img bọc bên trong
                }
                
                # Tránh lưu trùng lặp
                if item not in reels_data:
                    reels_data.append(item)

        print(f"Tổng số video/reels thu thập được: {len(reels_data)}")

        # Lưu dữ liệu trực tiếp vào file movies.json để GitHub Actions tự động commit
        with open("movies.json", "w", encoding="utf-8") as f:
            json.dump(reels_data, f, ensure_ascii=False, indent=4)
        
        print("Đã ghi file movies.json thành công!")

    except Exception as e:
        print(f"Đã xảy ra lỗi trong quá trình chạy scraper: {e}")
        
    finally:
        driver.quit()
        print("Đã đóng trình duyệt.")

if __name__ == "__main__":
    scrape_facebook_reels()
