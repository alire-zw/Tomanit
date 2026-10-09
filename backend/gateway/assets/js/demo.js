var demoMode = true;
var demoCaptchaCode = "";

function drawDemoCaptcha() {
  demoCaptchaCode = String(Math.floor(10000 + Math.random() * 90000));
  var canvas = document.createElement("canvas");
  canvas.width = 146;
  canvas.height = 48;
  var ctx = canvas.getContext("2d");
  ctx.fillStyle = "#EFF7F7";
  ctx.fillRect(0, 0, 146, 48);
  for (var i = 0; i < 6; i++) {
    ctx.strokeStyle = "rgba(0, 101, 106, " + (0.1 + Math.random() * 0.18) + ")";
    ctx.beginPath();
    ctx.moveTo(Math.random() * 146, Math.random() * 48);
    ctx.lineTo(Math.random() * 146, Math.random() * 48);
    ctx.stroke();
  }
  ctx.font = "bold 26px monospace";
  ctx.fillStyle = "#00656a";
  ctx.textAlign = "center";
  ctx.fillText(demoCaptchaCode, 73, 32);
  $("#CaptchaImage").attr("src", canvas.toDataURL("image/png"));
  $("input[id=CaptchaInputText]").val("");
  $("button[data-action=Otp]").removeClass("is-disabled");
}

function showDemoSuccess() {
  $("body").addClass("overlay");
  var $dialog = $(".dialog");
  $dialog.addClass("success-dialog");
  $dialog.find("#dialogTitle").text("پرداخت موفق");
  $dialog.find("#dialogDescription").html(
    '<i class="icn-check-badge success-icon" aria-hidden="true"></i>' +
    "<p>تراکنش شما در حالت نمایشی با موفقیت ثبت شد.</p>"
  );
  $dialog.find(".extra").html(
    '<button type="button" class="button success full-width" id="DemoCloseSuccess">بستن</button>'
  );
  if ($(window).width() <= 768) {
    if (!$dialog.hasClass("bottom-sheet")) $dialog.addClass("bottom-sheet");
    $dialog.fadeIn(5).css({ bottom: 0 });
  } else {
    $dialog.fadeIn(300);
  }
}

if (typeof getCaptcha === "function") {
  getCaptcha = function () {
    if (demoMode) {
      drawDemoCaptcha();
      return;
    }
  };
}

(function ($) {
  var originalRedirect = $.redirect;
  $.redirect = function (url, values, method, target, traditional, redirectTop) {
    if (demoMode && values && values.Action === "pay") {
      $("#Purchase").removeClass("in-progress");
      if (values.CaptchaInputText !== demoCaptchaCode) {
        if (typeof inputWrong === "function") {
          inputWrong($("#CaptchaInputText"), "کد امنیتی صحیح نیست");
        }
        return;
      }
      showDemoSuccess();
      return;
    }
    return originalRedirect.apply(this, arguments);
  };
})(jQuery);

$(document).ready(function () {
  $(document).on("click", "#DemoCloseSuccess", function () {
    $("body").removeClass("overlay");
    $(".dialog").fadeOut(300, function () {
      $(".dialog").removeClass("success-dialog bottom-sheet").removeAttr("style");
      $(".dialog .extra").html(
        '<button id="CancelConfirmed" name="CancelConfirmed" class="button danger full-width" data-action="CancelConfirmed" role="button" tabindex="0" aria-label="لغو پرداخت و خروج"><span>لغو پرداخت و خروج</span></button>' +
        '<button id="CancelNeverMind" name="CancelNeverMind" class="button outline full-width" data-action="CancelNeverMind" role="button" tabindex="0" aria-label="ادامه فرآیند پرداخت"><span>ادامه فرآیند پرداخت</span></button>'
      );
      $("#dialogTitle").text("لغو پرداخت");
      $("#dialogDescription").text("می‌خواهید پرداخت را لغو کنید؟");
      drawDemoCaptcha();
      $(".purchase-timer").removeAttr("stopped").startTimeoutAction({
        timeOut: parseInt($("[data-timeout]").attr("data-timeout") || 599000),
        timeoutCallback: $("#frmCancel")
      });
    });
  });

  $(document).on("click", "button[data-action=Otp]", function (e) {
    if (!demoMode) return;
    e.stopImmediatePropagation();
    if (!$("#frmPayment").valid() || (typeof checkFormError === "function" && checkFormError())) {
      return false;
    }
    if (typeof purchaseValidate === "function" && !purchaseValidate(true)) {
      return false;
    }
    var captcha = $("#CaptchaInputText").val();
    if (captcha !== demoCaptchaCode) {
      if (typeof inputWrong === "function") {
        inputWrong($("#CaptchaInputText"), "کد امنیتی صحیح نیست");
      }
      return false;
    }
    if (typeof showMessage === "function") {
      showMessage($("button[data-action=Otp]"), "رمز پویا به شماره همراه شما ارسال شد (نمایشی)", "success", true);
    }
    $("#Pin2").focus();
  });

  $(document).on("click", "button[data-action=CancelConfirmed]", function (e) {
    if (!demoMode) return;
    e.preventDefault();
    e.stopImmediatePropagation();
    window.location.href = "index.html";
  });
});
