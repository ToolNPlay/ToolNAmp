/**
 * ToolNAmp Native Windows Host (Ultra-Lightweight Win32 WebView2)
 * Developed by ToolNPlay.com • Authors: Pardeep Kumar & Harsh Suman
 * 
 * Compiles to a ~150 KB standalone native Windows executable.
 * Uses the pre-installed Microsoft Edge WebView2 runtime on Windows 10 & 11.
 */

#define WIN32_LEAN_AND_MEAN
#include <windows.h>
#include <shlobj.h>
#include <shlwapi.h>
#include <commdlg.h>
#include <string>
#include <vector>
#include <filesystem>
#include <iostream>

#include "webview.h"

namespace fs = std::filesystem;

static HWND g_hWnd = NULL;
static bool g_isAlwaysOnTop = false;

// Convert UTF-8 std::string to std::wstring
static std::wstring to_wstring(const std::string& str) {
    if (str.empty()) return std::wstring();
    int size = MultiByteToWideChar(CP_UTF8, 0, &str[0], (int)str.size(), NULL, 0);
    std::wstring wstr(size, 0);
    MultiByteToWideChar(CP_UTF8, 0, &str[0], (int)str.size(), &wstr[0], size);
    return wstr;
}

// Convert std::wstring to UTF-8 std::string
static std::string to_utf8(const std::wstring& wstr) {
    if (wstr.empty()) return std::string();
    int size = WideCharToMultiByte(CP_UTF8, 0, &wstr[0], (int)wstr.size(), NULL, 0, NULL, NULL);
    std::string str(size, 0);
    WideCharToMultiByte(CP_UTF8, 0, &wstr[0], (int)wstr.size(), &str[0], size, NULL, NULL);
    return str;
}

// Convert file path to file:// URL
static std::string file_to_url(const fs::path& p) {
    std::string pathStr = p.string();
    for (char &c : pathStr) {
        if (c == '\\') c = '/';
    }
    return "file:///" + pathStr;
}

// Escape JSON string characters
static std::string escape_json(const std::string& s) {
    std::string out;
    for (char c : s) {
        if (c == '"') out += "\\\"";
        else if (c == '\\') out += "\\\\";
        else if (c == '\b') out += "\\b";
        else if (c == '\f') out += "\\f";
        else if (c == '\n') out += "\\n";
        else if (c == '\r') out += "\\r";
        else if (c == '\t') out += "\\t";
        else out += c;
    }
    return out;
}

// Recursively find audio files in a folder
static void scan_audio_folder(const fs::path& folder, std::vector<fs::path>& outFiles) {
    try {
        for (const auto& entry : fs::recursive_directory_iterator(folder, fs::directory_options::skip_permission_denied)) {
            if (entry.is_regular_file()) {
                auto ext = entry.path().extension().string();
                for (char &c : ext) c = tolower(c);
                if (ext == ".mp3" || ext == ".wav" || ext == ".flac" || ext == ".ogg" || 
                    ext == ".m4a" || ext == ".aac" || ext == ".aiff" || ext == ".webm") {
                    outFiles.push_back(entry.path());
                }
            }
        }
    } catch (...) {}
}

int WINAPI WinMain(HINSTANCE hInstance, HINSTANCE hPrevInstance, LPSTR lpCmdLine, int nCmdShow) {
    // 1. Locate the HTML assets directory relative to the executable
    wchar_t exePath[MAX_PATH];
    GetModuleFileNameW(NULL, exePath, MAX_PATH);
    PathRemoveFileSpecW(exePath);

    fs::path baseDir(exePath);
    fs::path indexPath = baseDir / "web" / "index.html";

    // Fallbacks for development / alternate folder structures
    if (!fs::exists(indexPath)) {
        indexPath = baseDir / "src" / "web" / "index.html";
    }
    if (!fs::exists(indexPath)) {
        indexPath = baseDir / ".." / "src" / "web" / "index.html";
    }

    std::string targetUrl;
    if (fs::exists(indexPath)) {
        targetUrl = file_to_url(fs::canonical(indexPath));
    } else {
        // Fallback default message if assets not found
        targetUrl = "data:text/html,<html><body style='background:#0c0e14;color:#fff;font-family:sans-serif;padding:40px;text-align:center;'><h2>ToolNAmp Assets Not Found</h2><p>Please place the <b>web/</b> folder in the same directory as ToolNAmp.exe.</p></body></html>";
    }

    try {
        // 2. Initialize Edge WebView2 Window
        webview::webview w(false, nullptr);
        w.set_title("ToolNAmp");
        w.set_size(860, 640, WEBVIEW_HINT_NONE);

        g_hWnd = (HWND)w.window().value();

        // 3. Register Native Action Bridge
        w.bind("sendNativeAction", [&](const std::string &req) -> std::string {
            // req is a JSON array string containing args passed from JS, e.g. ["openFile", {}]
            if (req.find("\"closeWindow\"") != std::string::npos) {
                w.terminate();
            } else if (req.find("\"minimizeWindow\"") != std::string::npos) {
                if (g_hWnd) ShowWindow(g_hWnd, SW_MINIMIZE);
            } else if (req.find("\"maximizeWindow\"") != std::string::npos || req.find("\"zoomWindow\"") != std::string::npos) {
                if (g_hWnd) {
                    if (IsZoomed(g_hWnd)) {
                        ShowWindow(g_hWnd, SW_RESTORE);
                    } else {
                        ShowWindow(g_hWnd, SW_MAXIMIZE);
                    }
                }
            } else if (req.find("\"setAlwaysOnTop\"") != std::string::npos) {
                if (g_hWnd) {
                    g_isAlwaysOnTop = !g_isAlwaysOnTop;
                    SetWindowPos(g_hWnd, g_isAlwaysOnTop ? HWND_TOPMOST : HWND_NOTOPMOST, 0, 0, 0, 0, SWP_NOMOVE | SWP_NOSIZE);
                }
            } else if (req.find("\"openFile\"") != std::string::npos) {
                wchar_t fileBuf[32768] = {0};
                OPENFILENAMEW ofn = {0};
                ofn.lStructSize = sizeof(ofn);
                ofn.hwndOwner = g_hWnd;
                ofn.lpstrFilter = L"Audio Files (*.mp3;*.wav;*.flac;*.m4a;*.ogg;*.aac)\0*.mp3;*.wav;*.flac;*.m4a;*.ogg;*.aac\0All Files (*.*)\0*.*\0";
                ofn.lpstrFile = fileBuf;
                ofn.nMaxFile = sizeof(fileBuf) / sizeof(wchar_t);
                ofn.Flags = OFN_EXPLORER | OFN_FILEMUSTEXIST | OFN_ALLOWMULTISELECT;

                if (GetOpenFileNameW(&ofn)) {
                    std::vector<fs::path> selectedFiles;
                    wchar_t* p = fileBuf;
                    std::wstring dir = p;
                    p += dir.length() + 1;

                    if (*p == 0) {
                        // Single file selected
                        selectedFiles.push_back(fs::path(dir));
                    } else {
                        // Multiple files selected
                        while (*p) {
                            selectedFiles.push_back(fs::path(dir) / p);
                            p += wcslen(p) + 1;
                        }
                    }

                    if (!selectedFiles.empty()) {
                        std::string json = "[";
                        for (size_t i = 0; i < selectedFiles.size(); ++i) {
                            auto& f = selectedFiles[i];
                            std::string filename = f.filename().string();
                            std::string stem = f.stem().string();
                            std::string artist = "Local Music";
                            std::string title = stem;
                            if (stem.find(" - ") != std::string::npos) {
                                auto sep = stem.find(" - ");
                                artist = stem.substr(0, sep);
                                title = stem.substr(sep + 3);
                            }
                            std::string url = file_to_url(f);
                            std::string ext = f.extension().string();
                            if (!ext.empty() && ext[0] == '.') ext = ext.substr(1);
                            for (char &c : ext) c = toupper(c);

                            if (i > 0) json += ",";
                            json += "{\"title\":\"" + escape_json(title) + "\",\"artist\":\"" + escape_json(artist) + "\",\"url\":\"" + escape_json(url) + "\",\"format\":\"" + ext + "\"}";
                        }
                        json += "]";

                        std::string script = "if (window.toolNAmp) { window.toolNAmp.addTracksBatch(JSON.parse('" + escape_json(json) + "')); }";
                        w.eval(script);
                    }
                }
            } else if (req.find("\"openFolder\"") != std::string::npos || req.find("\"autoScanMusic\"") != std::string::npos) {
                BROWSEINFOW bi = {0};
                bi.hwndOwner = g_hWnd;
                bi.lpszTitle = L"Select Music Folder for ToolNAmp";
                bi.ulFlags = BIF_RETURNONLYFSDIRS | BIF_NEWDIALOGSTYLE;
                LPITEMIDLIST pidl = SHBrowseForFolderW(&bi);
                if (pidl != 0) {
                    wchar_t path[MAX_PATH];
                    if (SHGetPathFromIDListW(pidl, path)) {
                        std::vector<fs::path> foundAudio;
                        scan_audio_folder(fs::path(path), foundAudio);

                        if (!foundAudio.empty()) {
                            std::string json = "[";
                            for (size_t i = 0; i < foundAudio.size(); ++i) {
                                auto& f = foundAudio[i];
                                std::string stem = f.stem().string();
                                std::string artist = "Local Music";
                                std::string title = stem;
                                if (stem.find(" - ") != std::string::npos) {
                                    auto sep = stem.find(" - ");
                                    artist = stem.substr(0, sep);
                                    title = stem.substr(sep + 3);
                                }
                                std::string url = file_to_url(f);
                                std::string ext = f.extension().string();
                                if (!ext.empty() && ext[0] == '.') ext = ext.substr(1);
                                for (char &c : ext) c = toupper(c);

                                if (i > 0) json += ",";
                                json += "{\"title\":\"" + escape_json(title) + "\",\"artist\":\"" + escape_json(artist) + "\",\"url\":\"" + escape_json(url) + "\",\"format\":\"" + ext + "\"}";
                            }
                            json += "]";

                            std::string script = "if (window.toolNAmp) { window.toolNAmp.addTracksBatch(JSON.parse('" + escape_json(json) + "')); }";
                            w.eval(script);
                        }
                    }
                    CoTaskMemFree(pidl);
                }
            }
            return "{\"status\":\"ok\"}";
        });

        // 4. Navigate and run
        w.navigate(targetUrl);
        w.run();

    } catch (const webview::exception &e) {
        std::string err = std::string("ToolNAmp failed to initialize WebView2:\n\n") + e.what() + "\n\nPlease ensure Microsoft Edge WebView2 is installed.";
        MessageBoxA(NULL, err.c_str(), "ToolNAmp Error", MB_ICONERROR | MB_OK);
        return 1;
    }

    return 0;
}
