#import <Cocoa/Cocoa.h>
#import <WebKit/WebKit.h>

#pragma clang diagnostic ignored "-Wdeprecated-declarations"

// --- Custom WKURLSchemeHandler for macamp-audio:// ---
// Directly streams local audio files to WebKit with HTTP 206 Partial Content (range requests)
@interface MacAmpAudioSchemeHandler : NSObject <WKURLSchemeHandler>
@end

@implementation MacAmpAudioSchemeHandler

- (void)webView:(WKWebView *)webView startURLSchemeTask:(id<WKURLSchemeTask>)urlSchemeTask {
    NSURL *url = urlSchemeTask.request.URL;
    NSString *path = [url path];
    
    // Check if file exists
    if (![[NSFileManager defaultManager] fileExistsAtPath:path]) {
        NSError *error = [NSError errorWithDomain:NSURLErrorDomain code:NSURLErrorFileDoesNotExist userInfo:nil];
        [urlSchemeTask didFailWithError:error];
        return;
    }
    
    NSString *ext = [[path pathExtension] lowercaseString];
    NSString *mimeType = @"audio/mpeg";
    if ([ext isEqualToString:@"wav"]) mimeType = @"audio/wav";
    else if ([ext isEqualToString:@"flac"]) mimeType = @"audio/flac";
    else if ([ext isEqualToString:@"m4a"] || [ext isEqualToString:@"aac"]) mimeType = @"audio/mp4";
    else if ([ext isEqualToString:@"ogg"]) mimeType = @"audio/ogg";
    else if ([ext isEqualToString:@"aiff"] || [ext isEqualToString:@"aif"]) mimeType = @"audio/aiff";
    else if ([ext isEqualToString:@"webm"]) mimeType = @"audio/webm";
    
    NSDictionary *fileAttrs = [[NSFileManager defaultManager] attributesOfItemAtPath:path error:nil];
    long long fileSize = [fileAttrs[NSFileSize] longLongValue];
    
    // Check for HTTP Range header
    NSDictionary *headers = urlSchemeTask.request.allHTTPHeaderFields;
    NSString *rangeHeader = headers[@"Range"];
    
    if (rangeHeader && [rangeHeader hasPrefix:@"bytes="]) {
        NSString *rangeVal = [rangeHeader substringFromIndex:6];
        NSArray *parts = [rangeVal componentsSeparatedByString:@"-"];
        long long start = [parts[0] longLongValue];
        long long end = (parts.count > 1 && [parts[1] length] > 0) ? [parts[1] longLongValue] : (fileSize - 1);
        if (end >= fileSize) end = fileSize - 1;
        long long length = end - start + 1;
        
        NSFileHandle *fileHandle = [NSFileHandle fileHandleForReadingAtPath:path];
        [fileHandle seekToFileOffset:start];
        NSData *rangeData = [fileHandle readDataOfLength:(NSUInteger)length];
        [fileHandle closeFile];
        
        NSDictionary *responseHeaders = @{
            @"Content-Type": mimeType,
            @"Content-Length": [NSString stringWithFormat:@"%lld", length],
            @"Content-Range": [NSString stringWithFormat:@"bytes %lld-%lld/%lld", start, end, fileSize],
            @"Accept-Ranges": @"bytes",
            @"Access-Control-Allow-Origin": @"*"
        };
        
        NSHTTPURLResponse *response = [[NSHTTPURLResponse alloc] initWithURL:url
                                                                  statusCode:206
                                                                 HTTPVersion:@"HTTP/1.1"
                                                                headerFields:responseHeaders];
        [urlSchemeTask didReceiveResponse:response];
        [urlSchemeTask didReceiveData:rangeData];
        [urlSchemeTask didFinish];
    } else {
        NSData *fullData = [NSData dataWithContentsOfFile:path options:NSDataReadingMappedIfSafe error:nil];
        NSDictionary *responseHeaders = @{
            @"Content-Type": mimeType,
            @"Content-Length": [NSString stringWithFormat:@"%lld", fileSize],
            @"Accept-Ranges": @"bytes",
            @"Access-Control-Allow-Origin": @"*"
        };
        NSHTTPURLResponse *response = [[NSHTTPURLResponse alloc] initWithURL:url
                                                                  statusCode:200
                                                                 HTTPVersion:@"HTTP/1.1"
                                                                headerFields:responseHeaders];
        [urlSchemeTask didReceiveResponse:response];
        if (fullData) {
            [urlSchemeTask didReceiveData:fullData];
        }
        [urlSchemeTask didFinish];
    }
}

- (void)webView:(WKWebView *)webView stopURLSchemeTask:(id<WKURLSchemeTask>)urlSchemeTask {
    // Stop handler
}

@end


@class MacAmpAppDelegate;

@interface MacAmpWebView : WKWebView
@end

@implementation MacAmpWebView

- (NSDragOperation)draggingEntered:(id<NSDraggingInfo>)sender {
    NSPasteboard *pboard = [sender draggingPasteboard];
    if ([[pboard types] containsObject:NSPasteboardTypeFileURL]) {
        return NSDragOperationCopy;
    }
    return [super draggingEntered:sender];
}

- (NSDragOperation)draggingUpdated:(id<NSDraggingInfo>)sender {
    NSPasteboard *pboard = [sender draggingPasteboard];
    if ([[pboard types] containsObject:NSPasteboardTypeFileURL]) {
        return NSDragOperationCopy;
    }
    return [super draggingUpdated:sender];
}

- (BOOL)performDragOperation:(id<NSDraggingInfo>)sender {
    NSPasteboard *pboard = [sender draggingPasteboard];
    NSArray *classes = @[[NSURL class]];
    NSDictionary *options = @{NSPasteboardURLReadingFileURLsOnlyKey: @YES};
    NSArray *urls = [pboard readObjectsForClasses:classes options:options];
    
    if (urls.count > 0) {
        id delegate = [NSApp delegate];
        if ([delegate respondsToSelector:@selector(handleDroppedURLs:)]) {
            [delegate performSelector:@selector(handleDroppedURLs:) withObject:urls];
            return YES;
        }
    }
    return [super performDragOperation:sender];
}

@end


@interface MacAmpAppDelegate : NSObject <NSApplicationDelegate, NSWindowDelegate, WKScriptMessageHandler, WKNavigationDelegate>
@property (strong, nonatomic) NSWindow *window;
@property (strong, nonatomic) MacAmpWebView *webView;
@property (assign, nonatomic) NSRect savedWindowFrame;
@property (assign, nonatomic) BOOL isMiniMode;
@property (assign, nonatomic) BOOL isMaximized;
@property (assign, nonatomic) NSRect unmaximizedFrame;
- (void)handleDroppedURLs:(NSArray<NSURL *> *)urls;
- (void)addTracksToPlaylistFromURLs:(NSArray<NSURL *> *)urls;
- (void)scanAndCollectFolder:(NSURL *)folderURL intoArray:(NSMutableArray<NSURL *> *)outArray;
@end

@implementation MacAmpAppDelegate

- (void)applicationDidFinishLaunching:(NSNotification *)aNotification {
    // 1. Create Main Window
    NSScreen *screen = [NSScreen mainScreen];
    NSRect screenRect = [screen visibleFrame];
    CGFloat initialWidth = 860;
    CGFloat initialHeight = 640;
    CGFloat xPos = screenRect.origin.x + (screenRect.size.width - initialWidth) / 2.0;
    CGFloat yPos = screenRect.origin.y + (screenRect.size.height - initialHeight) / 2.0;
    
    NSRect windowRect = NSMakeRect(xPos, yPos, initialWidth, initialHeight);
    self.unmaximizedFrame = windowRect;
    self.isMaximized = NO;
    
    NSWindowStyleMask styleMask = NSWindowStyleMaskTitled |
                                  NSWindowStyleMaskClosable |
                                  NSWindowStyleMaskMiniaturizable |
                                  NSWindowStyleMaskResizable |
                                  NSWindowStyleMaskFullSizeContentView;
                                  
    self.window = [[NSWindow alloc] initWithContentRect:windowRect
                                              styleMask:styleMask
                                                backing:NSBackingStoreBuffered
                                                  defer:NO];
                                                  
    [self.window setTitle:@"ToolNAmp"];
    [self.window setMinSize:NSMakeSize(540, 420)];
    [self.window setTitlebarAppearsTransparent:YES];
    [self.window setTitleVisibility:NSWindowTitleHidden];
    [self.window setMovableByWindowBackground:NO]; // We handle custom dragging in header for 100% precision
    [self.window setBackgroundColor:[NSColor colorWithCalibratedRed:0.12 green:0.13 blue:0.16 alpha:1.0]];
    [self.window setDelegate:self];
    
    // Configure native green traffic light button to Zoom/Maximize smoothly to screen bounds
    [self.window setCollectionBehavior:NSWindowCollectionBehaviorFullScreenAuxiliary];
    NSButton *zoomBtn = [self.window standardWindowButton:NSWindowZoomButton];
    if (zoomBtn) {
        [zoomBtn setTarget:self];
        [zoomBtn setAction:@selector(toggleMaximizeWindow)];
    }
    
    // 2. Configure WKWebView with audio scheme handler
    WKWebViewConfiguration *config = [[WKWebViewConfiguration alloc] init];
    config.mediaTypesRequiringUserActionForPlayback = WKAudiovisualMediaTypeNone;
    
    // Register toolnamp-audio:// and macamp-audio:// scheme handlers
    [config setURLSchemeHandler:[[MacAmpAudioSchemeHandler alloc] init] forURLScheme:@"toolnamp-audio"];
    [config setURLSchemeHandler:[[MacAmpAudioSchemeHandler alloc] init] forURLScheme:@"macamp-audio"];
    
    @try {
        [config.preferences setValue:@YES forKey:@"allowFileAccessFromFileURLs"];
        [config.preferences setValue:@YES forKey:@"developerExtrasEnabled"];
        [config setValue:@YES forKey:@"allowUniversalAccessFromFileURLs"];
    } @catch (NSException *e) {}
    
    // Script message handler
    [config.userContentController addScriptMessageHandler:self name:@"toolnamp"];
    [config.userContentController addScriptMessageHandler:self name:@"macamp"];
    
    self.webView = [[MacAmpWebView alloc] initWithFrame:self.window.contentView.bounds configuration:config];
    [self.webView setAutoresizingMask:(NSViewWidthSizable | NSViewHeightSizable)];
    [self.webView setNavigationDelegate:self];
    [self.webView registerForDraggedTypes:@[NSPasteboardTypeFileURL]];
    
    if (@available(macOS 10.14, *)) {
        [self.webView setValue:@NO forKey:@"drawsBackground"];
    }
    
    [self.window.contentView addSubview:self.webView];
    
    // 3. Setup macOS Menu Bar
    [self setupMenuBar];
    
    // 4. Load Web Application with full filesystem read access
    NSString *resourcePath = [[NSBundle mainBundle] resourcePath];
    NSString *webDir = [resourcePath stringByAppendingPathComponent:@"web"];
    NSString *indexPath = [webDir stringByAppendingPathComponent:@"index.html"];
    
    if (![[NSFileManager defaultManager] fileExistsAtPath:indexPath]) {
        NSString *currentDir = [[NSFileManager defaultManager] currentDirectoryPath];
        webDir = [currentDir stringByAppendingPathComponent:@"src/web"];
        indexPath = [webDir stringByAppendingPathComponent:@"index.html"];
    }
    
    NSURL *fileURL = [NSURL fileURLWithPath:indexPath];
    // Grant read access to / so any music file on disk can be loaded
    NSURL *readAccessURL = [NSURL fileURLWithPath:@"/" isDirectory:YES];
    
    [self.webView loadFileURL:fileURL allowingReadAccessToURL:readAccessURL];
    
    // 5. Show Window
    [self.window makeKeyAndOrderFront:nil];
    [NSApp activateIgnoringOtherApps:YES];
}

- (BOOL)applicationShouldTerminateAfterLastWindowClosed:(NSApplication *)sender {
    return YES;
}

#pragma mark - Menu Bar Setup
- (void)setupMenuBar {
    NSMenu *mainMenu = [[NSMenu alloc] init];
    
    // App Menu
    NSMenuItem *appMenuItem = [[NSMenuItem alloc] init];
    [mainMenu addItem:appMenuItem];
    NSMenu *appMenu = [[NSMenu alloc] initWithTitle:@"ToolNAmp"];
    [appMenu addItemWithTitle:@"About ToolNAmp" action:@selector(showAbout) keyEquivalent:@""];
    [appMenu addItem:[NSMenuItem separatorItem]];
    [appMenu addItemWithTitle:@"Hide ToolNAmp" action:@selector(hide:) keyEquivalent:@"h"];
    [appMenu addItemWithTitle:@"Hide Others" action:@selector(hideOtherApplications:) keyEquivalent:@"h"];
    [[appMenu.itemArray lastObject] setKeyEquivalentModifierMask:NSEventModifierFlagOption | NSEventModifierFlagCommand];
    [appMenu addItemWithTitle:@"Show All" action:@selector(unhideAllApplications:) keyEquivalent:@""];
    [appMenu addItem:[NSMenuItem separatorItem]];
    [appMenu addItemWithTitle:@"Quit ToolNAmp" action:@selector(terminate:) keyEquivalent:@"q"];
    [appMenuItem setSubmenu:appMenu];
    
    // File Menu
    NSMenuItem *fileMenuItem = [[NSMenuItem alloc] init];
    [mainMenu addItem:fileMenuItem];
    NSMenu *fileMenu = [[NSMenu alloc] initWithTitle:@"File"];
    [fileMenu addItemWithTitle:@"Open Audio Files..." action:@selector(openFileAction) keyEquivalent:@"o"];
    [fileMenu addItemWithTitle:@"Open Folder of Music..." action:@selector(openFolderAction) keyEquivalent:@"O"];
    [fileMenu addItem:[NSMenuItem separatorItem]];
    [fileMenu addItemWithTitle:@"Close Window" action:@selector(performClose:) keyEquivalent:@"w"];
    [fileMenuItem setSubmenu:fileMenu];
    
    // Controls Menu
    NSMenuItem *ctrlMenuItem = [[NSMenuItem alloc] init];
    [mainMenu addItem:ctrlMenuItem];
    NSMenu *ctrlMenu = [[NSMenu alloc] initWithTitle:@"Controls"];
    [ctrlMenu addItemWithTitle:@"Play / Pause" action:@selector(menuPlayPause) keyEquivalent:@" "];
    [ctrlMenu addItemWithTitle:@"Next Track" action:@selector(menuNext) keyEquivalent:@">"];
    [ctrlMenu addItemWithTitle:@"Previous Track" action:@selector(menuPrev) keyEquivalent:@"<"];
    [ctrlMenu addItemWithTitle:@"Stop" action:@selector(menuStop) keyEquivalent:@"."];
    [ctrlMenu addItem:[NSMenuItem separatorItem]];
    [ctrlMenu addItemWithTitle:@"Mini Player / Window Shade" action:@selector(menuToggleMini) keyEquivalent:@"m"];
    [[ctrlMenu.itemArray lastObject] setKeyEquivalentModifierMask:NSEventModifierFlagShift | NSEventModifierFlagCommand];
    [ctrlMenuItem setSubmenu:ctrlMenu];
    
    // Window Menu
    NSMenuItem *winMenuItem = [[NSMenuItem alloc] init];
    [mainMenu addItem:winMenuItem];
    NSMenu *winMenu = [[NSMenu alloc] initWithTitle:@"Window"];
    [winMenu addItemWithTitle:@"Minimize" action:@selector(performMiniaturize:) keyEquivalent:@"m"];
    [winMenu addItemWithTitle:@"Zoom / Maximize" action:@selector(toggleMaximizeWindow) keyEquivalent:@""];
    [winMenu addItem:[NSMenuItem separatorItem]];
    [winMenu addItemWithTitle:@"Always on Top" action:@selector(menuToggleAlwaysOnTop) keyEquivalent:@"t"];
    [[winMenu.itemArray lastObject] setKeyEquivalentModifierMask:NSEventModifierFlagCommand | NSEventModifierFlagOption];
    [winMenuItem setSubmenu:winMenu];
    
    [NSApp setMainMenu:mainMenu];
}

- (void)showAbout {
    NSAlert *alert = [[NSAlert alloc] init];
    [alert setMessageText:@"⚡ ToolNAmp v1.0"];
    [alert setInformativeText:@"The Ultimate Retro High-Fidelity Music Player\n\n"
                              @"• Developed by: ToolNPlay.com\n"
                              @"• Authors: Pardeep Kumar & Harsh Suman\n\n"
                              @"Features:\n"
                              @"• 10-Band Graphic Equalizer with Presets & Preamp\n"
                              @"• 5 Real-Time 60fps Audio Visualizers\n"
                              @"• DSP Convolution Reverb & Sub-Bass Booster\n"
                              @"• Window Shade / Mini Player Mode\n"
                              @"• 25 Iconic Retro & Festival Themes\n"
                              @"• Auto-Restore Collection & Playback History\n\n"
                              @"Website: https://ToolNPlay.com"];
    [alert addButtonWithTitle:@"Rock On!"];
    [alert runModal];
}

#pragma mark - Menu Actions forwarded to Web
- (void)openFileAction {
    [self handleOpenFile];
}

- (void)openFolderAction {
    [self handleOpenFolder];
}

- (void)menuPlayPause {
    [self.webView evaluateJavaScript:@"(window.toolNAmp || window.macAmp) && (window.toolNAmp || window.macAmp).togglePlayPause()" completionHandler:nil];
}

- (void)menuNext {
    [self.webView evaluateJavaScript:@"(window.toolNAmp || window.macAmp) && (window.toolNAmp || window.macAmp).nextTrack()" completionHandler:nil];
}

- (void)menuPrev {
    [self.webView evaluateJavaScript:@"(window.toolNAmp || window.macAmp) && (window.toolNAmp || window.macAmp).prevTrack()" completionHandler:nil];
}

- (void)menuStop {
    [self.webView evaluateJavaScript:@"(window.toolNAmp || window.macAmp) && (window.toolNAmp || window.macAmp).stop()" completionHandler:nil];
}

- (void)menuToggleMini {
    [self.webView evaluateJavaScript:@"(window.toolNAmp || window.macAmp) && (window.toolNAmp || window.macAmp).toggleMiniMode()" completionHandler:nil];
}

- (void)menuToggleAlwaysOnTop {
    BOOL top = (self.window.level == NSFloatingWindowLevel);
    [self setAlwaysOnTop:!top];
}

- (void)setAlwaysOnTop:(BOOL)top {
    [self.window setLevel:(top ? NSFloatingWindowLevel : NSNormalWindowLevel)];
}

#pragma mark - Maximize & Restore
- (void)toggleMaximizeWindow {
    NSScreen *screen = self.window.screen ?: [NSScreen mainScreen];
    NSRect visibleFrame = [screen visibleFrame];
    
    if (self.isMaximized) {
        // Restore to normal size
        self.isMaximized = NO;
        NSRect target = (self.unmaximizedFrame.size.width >= 400 && self.unmaximizedFrame.size.height >= 300) ?
                        self.unmaximizedFrame :
                        NSMakeRect(visibleFrame.origin.x + (visibleFrame.size.width - 860) / 2.0,
                                   visibleFrame.origin.y + (visibleFrame.size.height - 640) / 2.0,
                                   860, 640);
        [self.window setFrame:target display:YES animate:YES];
        [self.webView evaluateJavaScript:@"(window.toolNAmp || window.macAmp) && (window.toolNAmp || window.macAmp).onMaximizeChanged(false)" completionHandler:nil];
    } else {
        // Maximize to full available screen
        self.unmaximizedFrame = self.window.frame;
        self.isMaximized = YES;
        [self.window setFrame:visibleFrame display:YES animate:YES];
        [self.webView evaluateJavaScript:@"(window.toolNAmp || window.macAmp) && (window.toolNAmp || window.macAmp).onMaximizeChanged(true)" completionHandler:nil];
    }
}

- (void)windowDidResize:(NSNotification *)notification {
    if (!self.isMaximized && !self.isMiniMode) {
        self.unmaximizedFrame = self.window.frame;
    }
}

#pragma mark - WKScriptMessageHandler
- (void)userContentController:(WKUserContentController *)userContentController didReceiveScriptMessage:(WKScriptMessage *)message {
    if (![message.body isKindOfClass:[NSDictionary class]]) return;
    
    NSDictionary *body = (NSDictionary *)message.body;
    NSString *action = body[@"action"];
    
    if ([action isEqualToString:@"closeWindow"]) {
        [self.window close];
        [NSApp terminate:nil];
    } else if ([action isEqualToString:@"minimizeWindow"]) {
        [self.window miniaturize:nil];
    } else if ([action isEqualToString:@"zoomWindow"] || [action isEqualToString:@"maximizeWindow"]) {
        [self toggleMaximizeWindow];
    } else if ([action isEqualToString:@"dragWindowDelta"]) {
        CGFloat dx = [body[@"dx"] doubleValue];
        CGFloat dy = [body[@"dy"] doubleValue];
        NSPoint origin = self.window.frame.origin;
        origin.x += dx;
        origin.y += dy;
        [self.window setFrameOrigin:origin];
    } else if ([action isEqualToString:@"startDrag"]) {
        NSEvent *event = [NSApp currentEvent];
        if (event) {
            @try {
                [self.window performWindowDragWithEvent:event];
            } @catch (NSException *e) {}
        }
    } else if ([action isEqualToString:@"showAbout"]) {
        [self showAbout];
    } else if ([action isEqualToString:@"setAlwaysOnTop"]) {
        BOOL val = [body[@"value"] boolValue];
        [self setAlwaysOnTop:val];
    } else if ([action isEqualToString:@"setMiniMode"]) {
        BOOL mini = [body[@"mini"] boolValue];
        [self applyMiniMode:mini];
    } else if ([action isEqualToString:@"openFile"]) {
        [self handleOpenFile];
    } else if ([action isEqualToString:@"openFolder"]) {
        [self handleOpenFolder];
    } else if ([action isEqualToString:@"saveCollection"]) {
        NSString *data = body[@"data"];
        if (data && [data isKindOfClass:[NSString class]]) {
            NSString *path = [self collectionFilePath];
            [data writeToFile:path atomically:YES encoding:NSUTF8StringEncoding error:nil];
        }
    }
}


#pragma mark - Collection Persistence Path & Navigation Delegate
- (NSString *)collectionFilePath {
    NSArray *paths = NSSearchPathForDirectoriesInDomains(NSApplicationSupportDirectory, NSUserDomainMask, YES);
    NSString *baseDir = paths.firstObject ?: NSTemporaryDirectory();
    NSString *appDir = [baseDir stringByAppendingPathComponent:@"ToolNAmp"];
    NSString *oldAppDir = [baseDir stringByAppendingPathComponent:@"MacAmp"];
    
    [[NSFileManager defaultManager] createDirectoryAtPath:appDir withIntermediateDirectories:YES attributes:nil error:nil];
    NSString *newPath = [appDir stringByAppendingPathComponent:@"collection.json"];
    NSString *oldPath = [oldAppDir stringByAppendingPathComponent:@"collection.json"];
    
    // Auto-migrate from MacAmp collection.json if needed
    if (![[NSFileManager defaultManager] fileExistsAtPath:newPath] && [[NSFileManager defaultManager] fileExistsAtPath:oldPath]) {
        [[NSFileManager defaultManager] copyItemAtPath:oldPath toPath:newPath error:nil];
    }
    
    return newPath;
}

- (void)webView:(WKWebView *)webView didFinishNavigation:(WKNavigation *)navigation {
    NSString *path = [self collectionFilePath];
    if ([[NSFileManager defaultManager] fileExistsAtPath:path]) {
        NSString *content = [NSString stringWithContentsOfFile:path encoding:NSUTF8StringEncoding error:nil];
        if (content && content.length > 0) {
            NSData *data = [content dataUsingEncoding:NSUTF8StringEncoding];
            if (data) {
                id obj = [NSJSONSerialization JSONObjectWithData:data options:0 error:nil];
                if (obj && [obj isKindOfClass:[NSDictionary class]]) {
                    NSString *escaped = [content stringByReplacingOccurrencesOfString:@"\\" withString:@"\\\\"];
                    escaped = [escaped stringByReplacingOccurrencesOfString:@"'" withString:@"\\'"];
                    escaped = [escaped stringByReplacingOccurrencesOfString:@"\n" withString:@"\\n"];
                    escaped = [escaped stringByReplacingOccurrencesOfString:@"\r" withString:@""];
                    NSString *js = [NSString stringWithFormat:@"(window.toolNAmp || window.macAmp) && (window.toolNAmp || window.macAmp).loadCollectionFromNative('%@');", escaped];
                    dispatch_async(dispatch_get_main_queue(), ^{
                        [self.webView evaluateJavaScript:js completionHandler:nil];
                    });
                }
            }
        }
    }
}

#pragma mark - Window Shade / Mini Mode Animation
- (void)applyMiniMode:(BOOL)mini {
    self.isMiniMode = mini;
    NSRect curFrame = self.window.frame;
    
    if (mini) {
        self.savedWindowFrame = curFrame;
        [self.window setMinSize:NSMakeSize(440, 48)];
        CGFloat newHeight = 48;
        CGFloat newWidth = 540;
        NSRect miniFrame = NSMakeRect(curFrame.origin.x, curFrame.origin.y + (curFrame.size.height - newHeight), newWidth, newHeight);
        [self.window setFrame:miniFrame display:YES animate:YES];
    } else {
        [self.window setMinSize:NSMakeSize(540, 420)];
        if (self.savedWindowFrame.size.height > 100) {
            [self.window setFrame:self.savedWindowFrame display:YES animate:YES];
        } else {
            NSRect restoreFrame = NSMakeRect(curFrame.origin.x, curFrame.origin.y - 592, 860, 640);
            [self.window setFrame:restoreFrame display:YES animate:YES];
        }
    }
}

#pragma mark - Native Open Panels & Drag-and-Drop
- (void)handleOpenFile {
    NSOpenPanel *panel = [NSOpenPanel openPanel];
    [panel setCanChooseFiles:YES];
    [panel setCanChooseDirectories:NO];
    [panel setAllowsMultipleSelection:YES];
    [panel setAllowedFileTypes:@[@"mp3", @"wav", @"flac", @"ogg", @"m4a", @"aac", @"aiff", @"webm"]];
    [panel setMessage:@"Select audio files to add to ToolNAmp playlist:"];
    
    [panel beginSheetModalForWindow:self.window completionHandler:^(NSModalResponse result) {
        if (result == NSModalResponseOK && panel.URLs.count > 0) {
            [self addTracksToPlaylistFromURLs:panel.URLs];
        }
    }];
}

- (void)handleOpenFolder {
    NSOpenPanel *panel = [NSOpenPanel openPanel];
    [panel setCanChooseFiles:NO];
    [panel setCanChooseDirectories:YES];
    [panel setAllowsMultipleSelection:NO];
    [panel setMessage:@"Select a folder of music to import:"];
    
    [panel beginSheetModalForWindow:self.window completionHandler:^(NSModalResponse result) {
        if (result == NSModalResponseOK && panel.URLs.count > 0) {
            NSURL *folderURL = panel.URLs.firstObject;
            NSMutableArray<NSURL *> *audioUrls = [NSMutableArray array];
            [self scanAndCollectFolder:folderURL intoArray:audioUrls];
            if (audioUrls.count > 0) {
                [self addTracksToPlaylistFromURLs:audioUrls];
            }
        }
    }];
}

- (void)scanAndCollectFolder:(NSURL *)folderURL intoArray:(NSMutableArray<NSURL *> *)outArray {
    NSFileManager *fm = [NSFileManager defaultManager];
    NSDirectoryEnumerator *enumerator = [fm enumeratorAtURL:folderURL
                                 includingPropertiesForKeys:@[NSURLNameKey, NSURLIsDirectoryKey]
                                                    options:(NSDirectoryEnumerationSkipsHiddenFiles)
                                               errorHandler:nil];
                                               
    for (NSURL *url in enumerator) {
        NSString *ext = [[url pathExtension] lowercaseString];
        if ([@[@"mp3", @"wav", @"flac", @"ogg", @"m4a", @"aac", @"aiff", @"webm"] containsObject:ext]) {
            [outArray addObject:url];
        }
    }
}

- (void)handleDroppedURLs:(NSArray<NSURL *> *)urls {
    NSMutableArray<NSURL *> *audioUrls = [NSMutableArray array];
    for (NSURL *url in urls) {
        NSNumber *isDir = nil;
        [url getResourceValue:&isDir forKey:NSURLIsDirectoryKey error:nil];
        if ([isDir boolValue]) {
            [self scanAndCollectFolder:url intoArray:audioUrls];
        } else {
            NSString *ext = [[url pathExtension] lowercaseString];
            if ([@[@"mp3", @"wav", @"flac", @"ogg", @"m4a", @"aac", @"aiff", @"webm"] containsObject:ext]) {
                [audioUrls addObject:url];
            }
        }
    }
    if (audioUrls.count > 0) {
        [self addTracksToPlaylistFromURLs:audioUrls];
    }
}

- (void)addTracksToPlaylistFromURLs:(NSArray<NSURL *> *)urls {
    if (urls.count == 0) return;
    
    if (urls.count == 1) {
        [self addTrackToPlaylistFromURL:urls.firstObject];
        return;
    }
    
    NSMutableArray *trackDicts = [NSMutableArray array];
    for (NSURL *url in urls) {
        NSString *filename = [url lastPathComponent];
        NSString *cleanName = [filename stringByDeletingPathExtension];
        NSString *artist = @"Local Music";
        NSString *title = cleanName;
        
        if ([cleanName containsString:@" - "]) {
            NSArray *parts = [cleanName componentsSeparatedByString:@" - "];
            artist = parts[0];
            title = [[parts subarrayWithRange:NSMakeRange(1, parts.count - 1)] componentsJoinedByString:@" - "];
        }
        
        NSString *audioURL = [NSString stringWithFormat:@"toolnamp-audio://local%@", [url path]];
        [trackDicts addObject:@{
            @"title": title,
            @"artist": artist,
            @"url": audioURL,
            @"format": [[url pathExtension] uppercaseString]
        }];
    }
    
    NSData *jsonData = [NSJSONSerialization dataWithJSONObject:trackDicts options:0 error:nil];
    if (!jsonData) return;
    NSString *jsonString = [[NSString alloc] initWithData:jsonData encoding:NSUTF8StringEncoding];
    NSString *escaped = [jsonString stringByReplacingOccurrencesOfString:@"\\" withString:@"\\\\"];
    escaped = [escaped stringByReplacingOccurrencesOfString:@"'" withString:@"\\'"];
    escaped = [escaped stringByReplacingOccurrencesOfString:@"\n" withString:@"\\n"];
    escaped = [escaped stringByReplacingOccurrencesOfString:@"\r" withString:@""];
    
    NSString *js = [NSString stringWithFormat:@"(window.toolNAmp || window.macAmp) && (window.toolNAmp || window.macAmp).addTracksBatchFromNative('%@');", escaped];
    dispatch_async(dispatch_get_main_queue(), ^{
        [self.webView evaluateJavaScript:js completionHandler:nil];
    });
}

- (void)addTrackToPlaylistFromURL:(NSURL *)url {
    NSString *filename = [url lastPathComponent];
    NSString *cleanName = [filename stringByDeletingPathExtension];
    NSString *artist = @"Local Music";
    NSString *title = cleanName;
    
    if ([cleanName containsString:@" - "]) {
        NSArray *parts = [cleanName componentsSeparatedByString:@" - "];
        artist = parts[0];
        title = [[parts subarrayWithRange:NSMakeRange(1, parts.count - 1)] componentsJoinedByString:@" - "];
    }
    
    // Convert to toolnamp-audio:// local streaming scheme
    NSString *audioURL = [NSString stringWithFormat:@"toolnamp-audio://local%@", [url path]];
    
    NSString *escapedTitle = [title stringByReplacingOccurrencesOfString:@"'" withString:@"\\'"];
    NSString *escapedArtist = [artist stringByReplacingOccurrencesOfString:@"'" withString:@"\\'"];
    NSString *escapedPath = [audioURL stringByReplacingOccurrencesOfString:@"'" withString:@"\\'"];
    
    NSString *js = [NSString stringWithFormat:
                    @"(window.toolNAmp || window.macAmp) && (window.toolNAmp || window.macAmp).addTrackFromNative('%@', '%@', '%@', '%@');",
                    escapedTitle, escapedArtist, escapedPath, [[url pathExtension] uppercaseString]];
                    
    dispatch_async(dispatch_get_main_queue(), ^{
        [self.webView evaluateJavaScript:js completionHandler:nil];
    });
}

@end

int main(int argc, const char * argv[]) {
    @autoreleasepool {
        NSApplication *app = [NSApplication sharedApplication];
        [app setActivationPolicy:NSApplicationActivationPolicyRegular];
        
        MacAmpAppDelegate *delegate = [[MacAmpAppDelegate alloc] init];
        [app setDelegate:delegate];
        [app run];
    }
    return 0;
}
