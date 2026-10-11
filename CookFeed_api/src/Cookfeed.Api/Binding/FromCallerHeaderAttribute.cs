using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.Mvc.ModelBinding;

namespace Cookfeed.Api.Binding;

/// <summary>
/// Marks the parameter that receives the caller's user id from the <c>X-User-Id</c> header, parsed by
/// <see cref="CallerIdModelBinder"/>. Use <c>int</c> where the caller is required and <c>int?</c> where it is optional.
/// </summary>
[AttributeUsage(AttributeTargets.Parameter)]
public sealed class FromCallerHeaderAttribute : ModelBinderAttribute
{
    public FromCallerHeaderAttribute()
        : base(typeof(CallerIdModelBinder))
    {
        BindingSource = BindingSource.Header;
        Name = CallerIdModelBinder.HeaderName;
    }
}
