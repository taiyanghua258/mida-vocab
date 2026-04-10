import sqlite3
import zipfile
import json
import os
import re
import argparse

def clean_data(text):
    """清洗 HTML 标签和 Anki 特有的媒体标签"""
    if not text: return ""
    # 去除 [sound:xxx.mp3] 语音标签
    text = re.sub(r'\[sound:[^\]]+\]', '', text)
    # 去除 <img> 标签
    text = re.sub(r'<img [^>]+>', '', text)
    # 去除常规 HTML 标签 (如 <div>, <br>, <span>)
    text = re.sub(r'<[^>]+>', '', text)
    # 去除多余空格和换行
    return text.strip()

def process_apkg(input_file, output_file):
    temp_dir = "temp_anki_extract"
    
    # 1. 解压 apkg 文件
    with zipfile.ZipFile(input_file, 'r') as zip_ref:
        zip_ref.extractall(temp_dir)
    
    # 2. 连接 Anki 数据库 (旧版为 collection.anki2, 新版为 collection.anki21)
    db_path = os.path.join(temp_dir, "collection.anki21")
    if not os.path.exists(db_path):
        db_path = os.path.join(temp_dir, "collection.anki2")
        
    conn = sqlite3.connect(db_path)
    cursor = conn.cursor()
    
    # 3. 查询笔记 (Notes)
    # flds 字段存放了单词的所有信息，以 \x1f 分隔
    cursor.execute("SELECT flds FROM notes")
    rows = cursor.fetchall()
    
    words_list = []
    for row in rows:
        fields = row[0].split('\x1f')
        # 假设常见的 Anki 词书结构: 0-原词, 1-读音, 2-释义, 3-词性
        if len(fields) >= 3:
            words_list.append({
                "japanese": clean_data(fields[0]),
                "reading": clean_data(fields[1]),
                "meaning": clean_data(fields[2]),
                "partOfSpeech": clean_data(fields[3]) if len(fields) > 3 else "名词",
                "tags": ["Anki转换"]
            })
            
    # 4. 导出为标准 JSON
    with open(output_file, 'w', encoding='utf-8') as f:
        json.dump(words_list, f, ensure_ascii=False, indent=2)
    
    # 5. 清理
    conn.close()
    import shutil
    shutil.rmtree(temp_dir)
    print(f"转换成功！共处理 {len(words_list)} 个单词，已保存至: {output_file}")

if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="Anki .apkg 转 JSON 转换工具")
    parser.add_argument("input", help="输入的 .apkg 文件路径")
    parser.add_argument("--output", default="converted_vocab.json", help="输出的 JSON 文件路径")
    args = parser.parse_args()
    
    process_apkg(args.input, args.output)
