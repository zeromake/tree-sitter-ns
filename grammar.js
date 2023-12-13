// , 分割的重复效果 [1,2,3], [1]
function commaSep1(rule) {
  return seq(rule, repeat(seq(",", rule)))
}

// , 分割的重复效果，但是不是必须的，可以支持类似 [1,2,3], []
function commaSep(rule) {
  return optional(commaSep1(rule))
}

module.exports = grammar({
  name: "ns",
  extras: $ => [/\s/],
  rules: {
    document: $ => repeat(
      choice(
        $.comment,
        $.command,
        $.label,
        // 使用变量渲染文本
        $.variable
      )
    ),
    // 注释
    comment: $ => seq(/;.*/),
    variable_name: $ => seq(/[a-zA-Z]/, /[0-9a-zA-Z_-]+/),
    // 标签
    label: $ => seq('*', $.variable_name),
    // int string array 变量
    variable: $ => seq(choice('$', '%', '?'), choice(/[1-9](\d+)?/, $.variable_name)),
    // 字符串表达式
    string: $ => choice(seq('"', '"'), seq('"', $.string_content, '"')),
    string_content: $ => repeat1(choice(
      token.immediate(prec(1, /[^\\"\n]+/))
    )),
    // 数字表达式
    integer: $ => {
      const decimal_digits = /\d+/;
      const decimal_integer = seq(
        optional(choice('-', '+')),
        choice(
          '0',
          seq(/[1-9]/, optional(decimal_digits))
        )
      );
      return token(decimal_integer);
    },
    // 参数表达式
    expression: $ => choice($.integer, $.string, $.variable, $.label),
    // 命令语句
    command: $ => seq(
      field("command", $.variable_name),
      prec.left(
        1,
        optional(
          seq(
            ' ',
            commaSep1(
              field("param", $.expression)
            )
          )
        )
      )
    )
  }
});

