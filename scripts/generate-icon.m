#import <Cocoa/Cocoa.h>

void drawIcon(CGContextRef ctx, CGFloat size) {
    NSRect rect = NSMakeRect(0, 0, size, size);
    
    // Squircle background with macOS rounded rect
    CGFloat cornerRadius = size * 0.2237; // Apple squircle corner ratio
    NSBezierPath *squircle = [NSBezierPath bezierPathWithRoundedRect:NSInsetRect(rect, size * 0.05, size * 0.05)
                                                             xRadius:cornerRadius
                                                             yRadius:cornerRadius];
    
    // Background gradient (Deep space titanium to cyber obsidian)
    NSGradient *bgGradient = [[NSGradient alloc] initWithStartingColor:[NSColor colorWithCalibratedRed:0.08 green:0.09 blue:0.12 alpha:1.0]
                                                           endingColor:[NSColor colorWithCalibratedRed:0.18 green:0.20 blue:0.24 alpha:1.0]];
    [bgGradient drawInBezierPath:squircle angle:285.0];
    
    // Subtle border glow
    [squircle setLineWidth:size * 0.02];
    [[NSColor colorWithCalibratedRed:0.35 green:0.40 blue:0.50 alpha:0.4] setStroke];
    [squircle stroke];
    
    // Winamp Lightning Bolt / Equalizer Glyph
    // Glowing golden amber / neon yellow lightning bolt
    NSBezierPath *bolt = [NSBezierPath bezierPath];
    
    // Scaled coordinates relative to size
    CGFloat s = size;
    [bolt moveToPoint:NSMakePoint(s * 0.54, s * 0.85)];
    [bolt lineToPoint:NSMakePoint(s * 0.32, s * 0.52)];
    [bolt lineToPoint:NSMakePoint(s * 0.48, s * 0.52)];
    [bolt lineToPoint:NSMakePoint(s * 0.42, s * 0.16)];
    [bolt lineToPoint:NSMakePoint(s * 0.70, s * 0.48)];
    [bolt lineToPoint:NSMakePoint(s * 0.54, s * 0.48)];
    [bolt closePath];
    
    // Shadow for bolt
    NSShadow *shadow = [[NSShadow alloc] init];
    [shadow setShadowColor:[NSColor colorWithCalibratedRed:1.0 green:0.65 blue:0.0 alpha:0.6]];
    [shadow setShadowOffset:NSMakeSize(0, -size * 0.02)];
    [shadow setShadowBlurRadius:size * 0.06];
    
    [NSGraphicsContext saveGraphicsState];
    [shadow set];
    
    // Gold/Orange Winamp Gradient
    NSGradient *boltGradient = [[NSGradient alloc] initWithStartingColor:[NSColor colorWithCalibratedRed:1.0 green:0.88 blue:0.20 alpha:1.0]
                                                             endingColor:[NSColor colorWithCalibratedRed:1.0 green:0.45 blue:0.0 alpha:1.0]];
    [boltGradient drawInBezierPath:bolt angle:270.0];
    [NSGraphicsContext restoreGraphicsState];
    
    // Audio Visualizer Bars behind / beside the bolt
    CGFloat barWidth = s * 0.038;
    CGFloat barGap = s * 0.022;
    CGFloat startX = s * 0.18;
    CGFloat baseY = s * 0.22;
    CGFloat heights[] = {0.18, 0.28, 0.42, 0.58, 0.50, 0.64, 0.45, 0.32, 0.20};
    
    for (int i = 0; i < 9; i++) {
        CGFloat h = heights[i] * s * 0.45;
        CGFloat x = startX + i * (barWidth + barGap);
        // Skip bars directly colliding with bolt center
        if (i >= 3 && i <= 5) continue;
        
        NSRect barRect = NSMakeRect(x, baseY, barWidth, h);
        NSBezierPath *bar = [NSBezierPath bezierPathWithRoundedRect:barRect xRadius:barWidth * 0.3 yRadius:barWidth * 0.3];
        
        // Green to amber gradient for retro spectrum
        NSColor *c1 = [NSColor colorWithCalibratedRed:0.0 green:0.95 blue:0.55 alpha:0.75];
        NSColor *c2 = [NSColor colorWithCalibratedRed:0.0 green:0.70 blue:0.95 alpha:0.75];
        NSGradient *barGrad = [[NSGradient alloc] initWithStartingColor:c1 endingColor:c2];
        [barGrad drawInBezierPath:bar angle:90.0];
    }
}

int main(int argc, const char * argv[]) {
    @autoreleasepool {
        NSString *destDir = @"/Users/pardeeppatel/Documents/Antigravity/MAC/MacAmp/assets";
        NSString *iconsetDir = [destDir stringByAppendingPathComponent:@"AppIcon.iconset"];
        [[NSFileManager defaultManager] createDirectoryAtPath:iconsetDir withIntermediateDirectories:YES attributes:nil error:nil];
        
        int sizes[] = {16, 32, 64, 128, 256, 512, 1024};
        for (int i = 0; i < 7; i++) {
            int s = sizes[i];
            NSBitmapImageRep *rep = [[NSBitmapImageRep alloc] initWithBitmapDataPlanes:NULL
                                                                            pixelsWide:s
                                                                            pixelsHigh:s
                                                                         bitsPerSample:8
                                                                       samplesPerPixel:4
                                                                              hasAlpha:YES
                                                                              isPlanar:NO
                                                                        colorSpaceName:NSCalibratedRGBColorSpace
                                                                           bytesPerRow:s * 4
                                                                          bitsPerPixel:32];
            
            NSGraphicsContext *context = [NSGraphicsContext graphicsContextWithBitmapImageRep:rep];
            [NSGraphicsContext setCurrentContext:context];
            
            drawIcon([context CGContext], (CGFloat)s);
            
            NSData *pngData = [rep representationUsingType:NSBitmapImageFileTypePNG properties:@{}];
            
            // Standard size
            if (s <= 512) {
                NSString *p1 = [iconsetDir stringByAppendingPathComponent:[NSString stringWithFormat:@"icon_%dx%d.png", s, s]];
                [pngData writeToFile:p1 atomically:YES];
            }
            // 2x Retina
            if (s >= 32) {
                int half = s / 2;
                NSString *p2 = [iconsetDir stringByAppendingPathComponent:[NSString stringWithFormat:@"icon_%dx%d@2x.png", half, half]];
                [pngData writeToFile:p2 atomically:YES];
            }
            
            if (s == 512) {
                NSString *mainPng = [destDir stringByAppendingPathComponent:@"icon.png"];
                [pngData writeToFile:mainPng atomically:YES];
            }
        }
        
        NSLog(@"AppIcon PNGs generated successfully in %@", iconsetDir);
    }
    return 0;
}
