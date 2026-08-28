package com.dairystream.app;

import com.getcapacitor.BridgeActivity;
import android.graphics.Color;
import android.os.Bundle;
import android.view.View;
import android.webkit.WebView;

public class MainActivity extends BridgeActivity {
    @Override
    public void onCreate(Bundle savedInstanceState) {
        WebView.setWebContentsDebuggingEnabled(true);
        super.onCreate(savedInstanceState);
        getWindow().getDecorView().setBackgroundColor(Color.WHITE);
        if (this.bridge != null && this.bridge.getWebView() != null) {
            this.bridge.getWebView().setBackgroundColor(Color.WHITE);
        }
    }
}
