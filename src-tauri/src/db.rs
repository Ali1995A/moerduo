use rusqlite::{Connection, Result};
use std::path::Path;

pub fn init_database(db_path: &Path) -> Result<Connection> {
    let conn = Connection::open(db_path)?;

    // 创建音频文件表
    conn.execute(
        "CREATE TABLE IF NOT EXISTS audio_files (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            filename TEXT NOT NULL,
            original_name TEXT NOT NULL,
            file_path TEXT NOT NULL,
            file_size INTEGER NOT NULL,
            duration INTEGER NOT NULL,
            format TEXT NOT NULL,
            upload_date DATETIME DEFAULT CURRENT_TIMESTAMP,
            play_count INTEGER DEFAULT 0,
            last_played DATETIME
        )",
        [],
    )?;

    // 创建播放列表表
    conn.execute(
        "CREATE TABLE IF NOT EXISTS playlists (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            name TEXT NOT NULL,
            play_mode TEXT DEFAULT 'sequential',
            created_date DATETIME DEFAULT CURRENT_TIMESTAMP,
            updated_date DATETIME DEFAULT CURRENT_TIMESTAMP
        )",
        [],
    )?;

    // 创建播放列表项表
    conn.execute(
        "CREATE TABLE IF NOT EXISTS playlist_items (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            playlist_id INTEGER NOT NULL,
            audio_id INTEGER NOT NULL,
            sort_order INTEGER NOT NULL,
            FOREIGN KEY (playlist_id) REFERENCES playlists(id) ON DELETE CASCADE,
            FOREIGN KEY (audio_id) REFERENCES audio_files(id) ON DELETE CASCADE,
            UNIQUE(playlist_id, audio_id)
        )",
        [],
    )?;

    // 创建定时任务表
    conn.execute(
        "CREATE TABLE IF NOT EXISTS scheduled_tasks (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            name TEXT NOT NULL,
            hour INTEGER NOT NULL,
            minute INTEGER NOT NULL,
            repeat_mode TEXT NOT NULL,
            custom_days TEXT,
            playlist_id INTEGER NOT NULL,
            volume INTEGER DEFAULT 50,
            fade_in_duration INTEGER DEFAULT 0,
            is_enabled BOOLEAN DEFAULT 1,
            priority INTEGER DEFAULT 0,
            created_date DATETIME DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (playlist_id) REFERENCES playlists(id) ON DELETE CASCADE
        )",
        [],
    )?;

    // 创建执行历史表
    conn.execute(
        "CREATE TABLE IF NOT EXISTS execution_history (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            task_id INTEGER NOT NULL,
            execution_time DATETIME DEFAULT CURRENT_TIMESTAMP,
            status TEXT NOT NULL,
            duration INTEGER,
            FOREIGN KEY (task_id) REFERENCES scheduled_tasks(id) ON DELETE CASCADE
        )",
        [],
    )?;

    // 创建应用设置表
    conn.execute(
        "CREATE TABLE IF NOT EXISTS app_settings (
            key TEXT PRIMARY KEY,
            value TEXT NOT NULL
        )",
        [],
    )?;

    // 数据库迁移：为 scheduled_tasks 添加 duration_minutes 字段
    // 检查字段是否存在，如果不存在则添加
    let column_exists: Result<i64, _> = conn.query_row(
        "SELECT COUNT(*) FROM pragma_table_info('scheduled_tasks') WHERE name='duration_minutes'",
        [],
        |row| row.get(0),
    );

    if let Ok(count) = column_exists {
        if count == 0 {
            conn.execute(
                "ALTER TABLE scheduled_tasks ADD COLUMN duration_minutes INTEGER",
                [],
            )?;
        }
    }

    // 创建播放历史记录表（用于统计和日历展示）
    conn.execute(
        "CREATE TABLE IF NOT EXISTS playback_history (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            audio_id INTEGER NOT NULL,
            audio_name TEXT NOT NULL,
            playlist_id INTEGER,
            playlist_name TEXT,
            play_time DATETIME DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (audio_id) REFERENCES audio_files(id) ON DELETE CASCADE,
            FOREIGN KEY (playlist_id) REFERENCES playlists(id) ON DELETE SET NULL
        )",
        [],
    )?;

    // 数据库迁移：为 playlist_items 添加 UNIQUE 约束
    // 检查是否存在 UNIQUE 约束
    let has_unique_constraint: Result<i64, _> = conn.query_row(
        "SELECT COUNT(*) FROM sqlite_master WHERE type='index'
         AND tbl_name='playlist_items'
         AND sql LIKE '%UNIQUE%playlist_id%audio_id%'",
        [],
        |row| row.get(0),
    );

    if let Ok(count) = has_unique_constraint {
        if count == 0 {
            // 先删除重复的记录，保留每组中 id 最小的记录
            conn.execute(
                "DELETE FROM playlist_items
                 WHERE id NOT IN (
                     SELECT MIN(id)
                     FROM playlist_items
                     GROUP BY playlist_id, audio_id
                 )",
                [],
            )?;

            // 为已存在的表添加 UNIQUE 约束
            // SQLite 不支持直接 ALTER TABLE ADD CONSTRAINT，需要重建表
            conn.execute("BEGIN TRANSACTION", [])?;

            // 创建新表
            conn.execute(
                "CREATE TABLE playlist_items_new (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    playlist_id INTEGER NOT NULL,
                    audio_id INTEGER NOT NULL,
                    sort_order INTEGER NOT NULL,
                    FOREIGN KEY (playlist_id) REFERENCES playlists(id) ON DELETE CASCADE,
                    FOREIGN KEY (audio_id) REFERENCES audio_files(id) ON DELETE CASCADE,
                    UNIQUE(playlist_id, audio_id)
                )",
                [],
            )?;

            // 复制数据
            conn.execute(
                "INSERT INTO playlist_items_new (id, playlist_id, audio_id, sort_order)
                 SELECT id, playlist_id, audio_id, sort_order FROM playlist_items",
                [],
            )?;

            // 删除旧表
            conn.execute("DROP TABLE playlist_items", [])?;

            // 重命名新表
            conn.execute("ALTER TABLE playlist_items_new RENAME TO playlist_items", [])?;

            conn.execute("COMMIT", [])?;
        }
    }

    Ok(conn)
}
