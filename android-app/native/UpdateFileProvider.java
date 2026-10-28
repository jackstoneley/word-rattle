package com.jackstoneley.wordrattle;

import androidx.core.content.FileProvider;

/** Shares a downloaded update with Android's installer. Its own class so it never clashes with Capacitor's FileProvider. */
public class UpdateFileProvider extends FileProvider {}
