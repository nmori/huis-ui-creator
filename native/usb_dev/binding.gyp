{
  "targets": [
    {
      "target_name": "usb_dev",
      "sources": [ "usb_dev.cc" ],
      "include_dirs": [
        "<!(node -p \"require('node-addon-api').include_dir\")"
      ],
      "defines": [ "NAPI_VERSION=8", "NAPI_DISABLE_CPP_EXCEPTIONS" ],
      "libraries": [
        "-lsetupapi"
      ],
      "msvs_settings": {
        "VCCLCompilerTool": {
          "AdditionalOptions": [ "/utf-8" ]
        }
      }
    }
  ]
}
