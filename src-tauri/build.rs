fn main() {
    // 图标变化时强制重跑 build script，否则 Windows 资源文件里的旧图标会被链接进 exe。
    // （tauri-build 不会自动监听 .ico 变化，不加这两行改图标后重新打包仍显示旧图标）
    println!("cargo:rerun-if-changed=icons/icon.ico");
    println!("cargo:rerun-if-changed=icons");
    tauri_build::build()
}
